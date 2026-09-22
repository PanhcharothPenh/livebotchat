import { supabase, UserRecord } from '../supabase.js';
import { logger } from '../utils/logger.js';

function withTimeout<T>(promise: Promise<T>, ms = 2000, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

const banCache = new Map<number, { isBanned: boolean; expiresAt: number }>();
const BAN_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

export class UserService {
  /**
   * Upsert a user when they message the bot
   */
  static async syncUser(userData: {
    id: number;
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    language?: string;
  }): Promise<UserRecord | null> {
    try {
      const now = new Date().toISOString();
      const task = async () => {
        const payload: Record<string, unknown> = {
          id: userData.id,
          username: userData.username || null,
          first_name: userData.first_name || null,
          last_name: userData.last_name || null,
          last_seen_at: now,
        };
        if (userData.language) payload.language = userData.language;

        const { data, error } = await supabase
          .from('users')
          .upsert(payload, { onConflict: 'id' })
          .select()
          .single();

        if (error) {
          logger.error(`Failed to sync user ${userData.id}:`, error);
          return null;
        }
        return data;
      };

      return await withTimeout(task(), 2000, null);
    } catch (err) {
      logger.error(`Exception in syncUser ${userData.id}:`, err);
      return null;
    }
  }

  /**
   * Update user language preference
   */
  static async setUserLanguage(userId: number, lang: string): Promise<boolean> {
    try {
      const task = async () => {
        const { error } = await supabase
          .from('users')
          .update({ language: lang })
          .eq('id', userId);

        return !error;
      };

      return await withTimeout(task(), 2000, false);
    } catch (err) {
      logger.error(`Exception in setUserLanguage ${userId}:`, err);
      return false;
    }
  }

  /**
   * Get user by Telegram ID
   */
  static async getUser(userId: number): Promise<UserRecord | null> {
    try {
      const task = async () => {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) return null;
        return data;
      };

      return await withTimeout(task(), 2000, null);
    } catch (err) {
      logger.error(`Exception in getUser ${userId}:`, err);
      return null;
    }
  }

  /**
   * Check if a user is currently banned
   */
  static async isUserBanned(userId: number): Promise<boolean> {
    const cached = banCache.get(userId);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.isBanned;
    }

    try {
      const task = async () => {
        const { data, error } = await supabase
          .from('users')
          .select('is_banned')
          .eq('id', userId)
          .single();

        if (error || !data) return false;
        return Boolean(data.is_banned);
      };

      const result = await withTimeout(task(), 1500, false);
      banCache.set(userId, { isBanned: result, expiresAt: Date.now() + BAN_CACHE_TTL });
      return result;
    } catch (err) {
      logger.error(`Exception in isUserBanned ${userId}:`, err);
      return false;
    }
  }

  /**
   * Ban or unban a user
   */
  static async setBanStatus(userId: number, isBanned: boolean): Promise<boolean> {
    banCache.set(userId, { isBanned, expiresAt: Date.now() + BAN_CACHE_TTL });
    try {
      const task = async () => {
        const { error } = await supabase
          .from('users')
          .update({ is_banned: isBanned })
          .eq('id', userId);

        return !error;
      };

      return await withTimeout(task(), 2000, false);
    } catch (err) {
      logger.error(`Exception in setBanStatus ${userId}:`, err);
      return false;
    }
  }

  /**
   * Get all active (unbanned) users for broadcasting
   */
  static async getAllActiveUsers(): Promise<UserRecord[]> {
    try {
      const task = async () => {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('is_banned', false);

        if (error || !data) return [];
        return data;
      };

      return await withTimeout(task(), 3000, []);
    } catch (err) {
      logger.error('Exception in getAllActiveUsers:', err);
      return [];
    }
  }

  /**
   * Fetch aggregate statistics
   */
  static async getStats(): Promise<{
    totalUsers: number;
    bannedUsers: number;
    openTickets: number;
    totalMessages: number;
  }> {
    try {
      const task = async () => {
        const [usersRes, bannedRes, ticketsRes, messagesRes] = await Promise.all([
          supabase.from('users').select('*', { count: 'exact', head: true }),
          supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_banned', true),
          supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
          supabase.from('messages').select('*', { count: 'exact', head: true }),
        ]);

        return {
          totalUsers: usersRes.count || 0,
          bannedUsers: bannedRes.count || 0,
          openTickets: ticketsRes.count || 0,
          totalMessages: messagesRes.count || 0,
        };
      };

      return await withTimeout(task(), 3000, { totalUsers: 0, bannedUsers: 0, openTickets: 0, totalMessages: 0 });
    } catch (err) {
      logger.error('Exception in getStats:', err);
      return { totalUsers: 0, bannedUsers: 0, openTickets: 0, totalMessages: 0 };
    }
  }
}
