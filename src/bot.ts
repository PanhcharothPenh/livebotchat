import { Bot, GrammyError, HttpError } from 'grammy';
import { config } from './config.js';
import { commandHandlers } from './handlers/commandHandler.js';
import { handleUserMessage } from './handlers/userHandler.js';
import { handleAdminReply } from './handlers/adminHandler.js';
import { handleCallbackQuery } from './handlers/callbackHandler.js';
import { logger } from './utils/logger.js';

let _botInstance: Bot | null = null;
let _cachedToken = '';

export function getBot(tokenOverride?: string): Bot {
  const token = (tokenOverride || process.env.TELEGRAM_BOT_TOKEN || config.telegramBotToken || '123456:dummytokenforbuild').trim();

  if (!_botInstance || _cachedToken !== token) {
    _cachedToken = token;
    _botInstance = new Bot(token);

    // Error handling
    _botInstance.catch((err) => {
      const ctx = err.ctx;
      logger.error(`Error while handling update ${ctx?.update?.update_id}:`, err.error);
      const e = err.error;
      if (e instanceof GrammyError) {
        logger.error('Error in request to Telegram:', e.description);
      } else if (e instanceof HttpError) {
        logger.error('Could not contact Telegram:', e);
      } else {
        logger.error('Unknown error:', e);
      }
    });

    // Commands
    _botInstance.command('id', commandHandlers.id);
    _botInstance.command('start', commandHandlers.start);
    _botInstance.command('help', commandHandlers.help);
    _botInstance.command('close', commandHandlers.close);
    _botInstance.command('ban', commandHandlers.ban);
    _botInstance.command('unban', commandHandlers.unban);
    _botInstance.command('info', commandHandlers.info);
    _botInstance.command('stats', commandHandlers.stats);
    _botInstance.command('broadcast', commandHandlers.broadcast);

    // Big Bottom Keyboard button handlers
    _botInstance.hears('🆔 ពិនិត្យ Chat ID & Telegram ID', commandHandlers.id);
    _botInstance.hears('❓ របៀបប្រើប្រាស់', commandHandlers.help);
    _botInstance.hears('📊 ស្ថិតិ (Stats)', commandHandlers.stats);

    // Interactive Callback Queries (Language selection, 5-star ratings, feedback categories)
    _botInstance.on('callback_query:data', handleCallbackQuery);

    // User & Admin Message Handlers
    _botInstance.on('message', async (ctx) => {
      const adminChatId = parseInt(process.env.ADMIN_CHAT_ID || String(config.adminChatId), 10);

      // If message is inside the admin chat
      if (ctx.chat.id === adminChatId) {
        await handleAdminReply(ctx);
        return;
      }

      // If message is in private chat with a regular user
      if (ctx.chat.type === 'private') {
        await handleUserMessage(ctx);
        return;
      }
    });
  }

  return _botInstance;
}

export const createBot = getBot;
export const bot = new Proxy({} as Bot, {
  get(_target, prop) {
    const liveBot = getBot();
    const value = (liveBot as unknown as Record<string, unknown>)[prop as string];
    if (typeof value === 'function') {
      return value.bind(liveBot);
    }
    return value;
  },
});
