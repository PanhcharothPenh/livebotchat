import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './config.js';

export interface UserRecord {
  id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  language?: string | null;
  is_banned: boolean;
  created_at?: string;
  last_seen_at?: string;
}

export interface TicketRecord {
  id: string;
  user_id: number;
  status: 'open' | 'closed';
  rating?: number | null;
  feedback?: string | null;
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

export interface StaffMemberRecord {
  id?: string;
  telegram_username: string;
  telegram_user_id?: number | null;
  display_name_km: string;
  role?: string | null;
  created_at?: string;
  updated_at?: string;
}

let _supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim() || config.supabaseUrl || 'https://placeholder.supabase.co';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || config.supabaseServiceRoleKey || 'placeholder-key';

  if (!_supabaseInstance) {
    _supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return _supabaseInstance;
}

// Proxy export for transparent backwards compatibility
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase();
    const value = (client as unknown as Record<string, unknown>)[prop as string];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
