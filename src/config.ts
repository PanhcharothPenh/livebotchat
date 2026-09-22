import dotenv from 'dotenv';
dotenv.config();

export interface Config {
  telegramBotToken: string;
  adminChatId: number;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  webhookSecret?: string;
  welcomeMessage: string;
  ticketClosedMessage: string;
}

export function loadConfig(): Config {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const adminChatIdStr = process.env.ADMIN_CHAT_ID || '0';
  const adminChatId = parseInt(adminChatIdStr, 10) || 0;
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const webhookSecret = process.env.WEBHOOK_SECRET || undefined;

  const welcomeMessage = process.env.WELCOME_MESSAGE || 
    '👋 Welcome to our Support Chat! Send us any question, message, or file here, and our support team will reply to you shortly.';
  
  const ticketClosedMessage = process.env.TICKET_CLOSED_MESSAGE || 
    '✅ Your support session has been marked as resolved. If you need help again, feel free to send a new message!';

  return {
    telegramBotToken,
    adminChatId,
    supabaseUrl,
    supabaseServiceRoleKey,
    webhookSecret,
    welcomeMessage,
    ticketClosedMessage,
  };
}

export const config = loadConfig();
