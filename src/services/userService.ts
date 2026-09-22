import { supabase, UserRecord } from '../supabase.js';
import { logger } from '../utils/logger.js';

export class UserService {
  /**
   * Upsert a user when they message the bot
   */
  static async syncUser(userData: {
    id: number;
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  }): Promise<UserRecord | null> {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('users')
        .upsert(
          {
            id: userData.id,
            username: userData.username || null,
            first_name: userData.first_name || null,
            last_name: userData.last_name || null,
            last_seen_at: now,
          },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (error) {
        logger.error(`Failed to sync user ${userData.id}:`, error);
        return null;
      }
      return data;
    } catch (err) {
      logger.error(`Exception in syncUser ${userData.id}:`, err);
      return null;
    }
  }

  /**
   * Get user by Telegram ID
   */
  static async getUser(userId: number): Promise<UserRecord | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        return null;
      }
      return data;
    } catch (err) {
      logger.error(`Exception in getUser ${userId}:`, err);
      return null;
    }
  }

  /**
   * Check if a user is currently banned
   */
  static async isUserBanned(userId: number): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('is_banned')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return false;
      }
      return Boolean(data.is_banned);
    } catch (err) {
      logger.error(`Exception in isUserBanned ${userId}:`, err);
      return false;
    }
  }

  /**
   * Ban or unban a user
   */
  static async setBanStatus(userId: number, isBanned: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_banned: isBanned })
        .eq('id', userId);

      if (error) {
        logger.error(`Failed to set ban status for ${userId}:`, error);
        return false;
      }
      return true;
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
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_banned', false);

      if (error || !data) {
        logger.error('Failed to fetch active users:', error);
        return [];
      }
      return data;
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
    } catch (err) {
      logger.error('Exception in getStats:', err);
      return { totalUsers: 0, bannedUsers: 0, openTickets: 0, totalMessages: 0 };
    }
  }
}
