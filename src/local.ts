import { bot } from './bot.js';
import { logger } from './utils/logger.js';

async function main() {
  logger.info('🚀 Starting Telegram Support Bot in local polling mode...');
  
  // Delete webhook if previously registered so polling works
  await bot.api.deleteWebhook({ drop_pending_updates: false });
  
  const botInfo = await bot.api.getMe();
  logger.info(`✅ Bot connected as @${botInfo.username} (ID: ${botInfo.id})`);
  
  await bot.start({
    onStart: () => {
      logger.info('🤖 Bot is running and listening for messages!');
    },
  });
}

main().catch((err) => {
  logger.error('Fatal error in local bot runner:', err);
  process.exit(1);
});
