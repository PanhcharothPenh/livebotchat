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

function getEnv(key: string, required = true, defaultValue = ''): string {
  const value = process.env[key] || defaultValue;
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function loadConfig(): Config {
  const telegramBotToken = getEnv('TELEGRAM_BOT_TOKEN', true);
  const adminChatIdStr = getEnv('ADMIN_CHAT_ID', true);
  const adminChatId = parseInt(adminChatIdStr, 10);

  if (isNaN(adminChatId)) {
    throw new Error(`Invalid ADMIN_CHAT_ID: "${adminChatIdStr}". Must be an integer or negative group ID (e.g., -1001234567890).`);
  }

  const supabaseUrl = getEnv('SUPABASE_URL', true);
  const supabaseServiceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', true);
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
