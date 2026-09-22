import dotenv from 'dotenv';
dotenv.config();

import { bot } from '../src/bot.js';
import { config } from '../src/config.js';

async function main() {
  const urlArg = process.argv[2];

  if (!urlArg) {
    console.error('\n❌ Usage: npm run set-webhook <YOUR_VERCEL_URL>');
    console.error('👉 Example: npm run set-webhook https://my-bot.vercel.app\n');
    process.exit(1);
  }

  const cleanUrl = urlArg.replace(/\/+$/, '');
  const webhookUrl = `${cleanUrl}/api/webhook`;

  console.log(`Setting webhook to: ${webhookUrl} ...`);

  await bot.api.setWebhook(webhookUrl, {
    secret_token: config.webhookSecret,
    allowed_updates: ['message', 'edited_message', 'callback_query'],
  });

  const info = await bot.api.getWebhookInfo();
  console.log('\n✅ Webhook configured successfully!');
  console.log('Webhook Info:', JSON.stringify(info, null, 2));
}

main().catch((err) => {
  console.error('Error setting webhook:', err);
  process.exit(1);
});
