import { supabase, TicketRecord } from '../supabase.js';
import { logger } from '../utils/logger.js';

export class TicketService {
  /**
   * Get an existing open ticket for a user, or create a new one
   */
  static async getOrCreateOpenTicket(userId: number): Promise<TicketRecord | null> {
    try {
      // Find open ticket
      const { data: openTicket, error: findError } = await supabase
        .from('tickets')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (findError) {
        logger.error(`Error querying open ticket for user ${userId}:`, findError);
      }

      if (openTicket) {
        return openTicket;
      }

      // Create new ticket
      const { data: newTicket, error: createError } = await supabase
        .from('tickets')
        .insert({
          user_id: userId,
          status: 'open',
        })
        .select()
        .single();

      if (createError) {
        logger.error(`Failed to create ticket for user ${userId}:`, createError);
        return null;
      }

      return newTicket;
    } catch (err) {
      logger.error(`Exception in getOrCreateOpenTicket for user ${userId}:`, err);
      return null;
    }
  }

  /**
   * Close any open ticket for a user
   */
  static async closeOpenTicket(userId: number): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('tickets')
        .update({
          status: 'closed',
          closed_at: now,
          updated_at: now,
        })
        .eq('user_id', userId)
        .eq('status', 'open');

      if (error) {
        logger.error(`Failed to close tickets for user ${userId}:`, error);
        return false;
      }
      return true;
    } catch (err) {
      logger.error(`Exception in closeOpenTicket for user ${userId}:`, err);
      return false;
    }
  }

  /**
   * Get ticket details by ID
   */
  static async getTicket(ticketId: string): Promise<TicketRecord | null> {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (error) return null;
      return data;
    } catch (err) {
      logger.error(`Exception in getTicket ${ticketId}:`, err);
      return null;
    }
  }
}
