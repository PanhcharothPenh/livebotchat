-- ==============================================================================
-- Telegram Live Chat Bot - Supabase Database Schema
-- Run this in your Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id BIGINT PRIMARY KEY, -- Telegram User ID
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    language TEXT NOT NULL DEFAULT 'km',
    is_banned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Support Tickets / Sessions Table
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    rating INT,
    feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ
);

-- 3. Messages & Routing Mapping Table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
    user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'admin', 'system')),
    user_message_id BIGINT,
    admin_message_id BIGINT,
    content_type TEXT NOT NULL DEFAULT 'text',
    text_content TEXT,
    media_file_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Staff Members Custom Display Name Table (CRUD)
CREATE TABLE IF NOT EXISTS public.staff_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_username TEXT UNIQUE NOT NULL,
    telegram_user_id BIGINT,
    display_name_km TEXT NOT NULL,
    role TEXT DEFAULT 'Staff',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Fast Lookup Indexes
CREATE INDEX IF NOT EXISTS idx_messages_admin_msg_id ON public.messages(admin_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_msg_id ON public.messages(user_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user_status ON public.tickets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_users_is_banned ON public.users(is_banned);
CREATE INDEX IF NOT EXISTS idx_staff_username ON public.staff_members(telegram_username);
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON public.staff_members(telegram_user_id);

-- 6. Enable Row Level Security (RLS) & Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

-- Allow service_role to have full access (bot uses service_role key)
DROP POLICY IF EXISTS "Service role has full access to users" ON public.users;
CREATE POLICY "Service role has full access to users" ON public.users 
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access to tickets" ON public.tickets;
CREATE POLICY "Service role has full access to tickets" ON public.tickets 
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access to messages" ON public.messages;
CREATE POLICY "Service role has full access to messages" ON public.messages 
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role has full access to staff_members" ON public.staff_members;
CREATE POLICY "Service role has full access to staff_members" ON public.staff_members 
    FOR ALL TO service_role USING (true) WITH CHECK (true);
