import { Bot, GrammyError, HttpError } from 'grammy';
import { config } from './config.js';
import { commandHandlers } from './handlers/commandHandler.js';
import { handleUserMessage } from './handlers/userHandler.js';
import { handleAdminReply } from './handlers/adminHandler.js';
import { logger } from './utils/logger.js';

export function createBot(): Bot {
  const bot = new Bot(config.telegramBotToken);

  // Error handling
  bot.catch((err) => {
    const ctx = err.ctx;
    logger.error(`Error while handling update ${ctx.update.update_id}:`, err.error);
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
  bot.command('start', commandHandlers.start);
  bot.command('help', commandHandlers.help);
  bot.command('close', commandHandlers.close);
  bot.command('ban', commandHandlers.ban);
  bot.command('unban', commandHandlers.unban);
  bot.command('info', commandHandlers.info);
  bot.command('stats', commandHandlers.stats);
  bot.command('broadcast', commandHandlers.broadcast);

  // User & Admin Message Handlers
  bot.on('message', async (ctx) => {
    // If message is inside the admin chat
    if (ctx.chat.id === config.adminChatId) {
      await handleAdminReply(ctx);
      return;
    }

    // If message is in private chat with a regular user
    if (ctx.chat.type === 'private') {
      await handleUserMessage(ctx);
      return;
    }
  });

  return bot;
}

export const bot = createBot();
