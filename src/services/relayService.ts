import { supabase, MessageRecord } from '../supabase.js';
import { logger } from '../utils/logger.js';

export class RelayService {
  /**
   * Record a relayed message (incoming from user, or reply from admin) in Supabase
   */
  static async recordMessage(msg: MessageRecord): Promise<MessageRecord | null> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert(msg)
        .select()
        .single();

      if (error) {
        logger.error('Failed to record message in Supabase:', error);
        return null;
      }
      return data;
    } catch (err) {
      logger.error('Exception in recordMessage:', err);
      return null;
    }
  }

  /**
   * Find the user and ticket associated with an admin group message ID.
   * When an admin uses Telegram's "Reply" on a forwarded message in the admin group,
   * Telegram provides the `reply_to_message.message_id`. We query our DB with this ID.
   */
  static async findMessageByAdminMsgId(adminMsgId: number): Promise<MessageRecord | null> {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('admin_message_id', adminMsgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return null;
      }
      return data;
    } catch (err) {
      logger.error(`Exception finding message by adminMsgId ${adminMsgId}:`, err);
      return null;
    }
  }

  /**
   * Get recent message history for a user
   */
  static async getUserMessageCount(userId: number): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) return 0;
      return count || 0;
    } catch {
      return 0;
    }
  }
}
