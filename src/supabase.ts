import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

export interface UserRecord {
  id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  is_banned: boolean;
  created_at?: string;
  last_seen_at?: string;
}

export interface TicketRecord {
  id: string;
  user_id: number;
  status: 'open' | 'closed';
  created_at?: string;
  updated_at?: string;
  closed_at?: string | null;
}

export interface MessageRecord {
  id?: string;
  ticket_id: string | null;
  user_id: number;
  sender_type: 'user' | 'admin' | 'system';
  user_message_id: number | null;
  admin_message_id: number | null;
  content_type: string;
  text_content: string | null;
  media_file_id: string | null;
  created_at?: string;
}

export const supabase = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
