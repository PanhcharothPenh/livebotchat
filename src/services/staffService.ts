import { supabase, StaffMemberRecord } from '../supabase.js';
import { logger } from '../utils/logger.js';

// In-memory cache for fast lookup during high concurrency
const staffCache = new Map<string, { record: StaffMemberRecord | null; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

export class StaffService {
  /**
   * Find staff member by Telegram username or Telegram user ID
   */
  static async getStaff(username?: string | null, userId?: number | null): Promise<StaffMemberRecord | null> {
    const cleanUsername = username ? username.replace(/^@/, '').toLowerCase().trim() : null;
    const cacheKey = cleanUsername || (userId ? `id_${userId}` : '');

    if (cacheKey && staffCache.has(cacheKey)) {
      const cached = staffCache.get(cacheKey)!;
      if (Date.now() < cached.expiresAt) {
        return cached.record;
      }
    }

    try {
      let query = supabase.from('staff_members').select('*');

      if (cleanUsername && userId) {
        query = query.or(`telegram_username.ilike.${cleanUsername},telegram_user_id.eq.${userId}`);
      } else if (cleanUsername) {
        query = query.ilike('telegram_username', cleanUsername);
      } else if (userId) {
        query = query.eq('telegram_user_id', userId);
      } else {
        return null;
      }

      const { data, error } = await query.limit(1).maybeSingle();

      if (error) {
        logger.debug('Could not query staff_members table (may not exist yet):', error.message);
        return null;
      }

      if (cacheKey) {
        staffCache.set(cacheKey, { record: data, expiresAt: Date.now() + CACHE_TTL_MS });
      }

      return data as StaffMemberRecord | null;
    } catch (err) {
      logger.debug('Error in StaffService.getStaff:', err);
      return null;
    }
  }

  /**
   * Get all registered staff members
   */
  static async getAllStaff(): Promise<StaffMemberRecord[]> {
    try {
      const { data, error } = await supabase
        .from('staff_members')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        logger.debug('Could not fetch staff list:', error.message);
        return [];
      }
      return (data || []) as StaffMemberRecord[];
    } catch (err) {
      logger.debug('Error in StaffService.getAllStaff:', err);
      return [];
    }
  }

  /**
   * Add or update a staff member
   */
  static async upsertStaff(staff: {
    telegram_username: string;
    display_name_km: string;
    role?: string | null;
    telegram_user_id?: number | null;
  }): Promise<StaffMemberRecord | null> {
    const cleanUsername = staff.telegram_username.replace(/^@/, '').trim();
    if (!cleanUsername || !staff.display_name_km.trim()) {
      throw new Error('Telegram username and Khmer display name are required.');
    }

    // Invalidate cache
    staffCache.clear();

    const payload = {
      telegram_username: cleanUsername,
      display_name_km: staff.display_name_km.trim(),
      role: staff.role?.trim() || 'Staff',
      telegram_user_id: staff.telegram_user_id || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('staff_members')
      .upsert(payload, { onConflict: 'telegram_username' })
      .select()
      .single();

    if (error) {
      logger.error('Failed to upsert staff member:', error);
      throw new Error(error.message);
    }

    return data as StaffMemberRecord;
  }

  /**
   * Delete a staff member by ID or username
   */
  static async deleteStaff(identifier: string): Promise<boolean> {
    staffCache.clear();
    const clean = identifier.replace(/^@/, '').trim();

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);

    let query = supabase.from('staff_members').delete();
    if (isUUID) {
      query = query.eq('id', clean);
    } else {
      query = query.ilike('telegram_username', clean);
    }

    const { error } = await query;
    if (error) {
      logger.error('Failed to delete staff member:', error);
      throw new Error(error.message);
    }
    return true;
  }
}
