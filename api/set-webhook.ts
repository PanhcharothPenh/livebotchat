import type { IncomingMessage, ServerResponse } from 'http';
import { Bot } from 'grammy';
import { logger } from '../src/utils/logger.js';

export default async function (req: IncomingMessage, res: ServerResponse) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();

    if (!token || token.includes('dummy')) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify(
          {
            success: false,
            error: 'TELEGRAM_BOT_TOKEN is missing in Vercel Environment Variables. Please add it and Redeploy.',
          },
          null,
          2
        )
      );
      return;
    }

    const host = req.headers.host || 'localhost';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const webhookUrl = `${protocol}://${host}/api/webhook`;

    // Dynamic bot instance with live token
    const liveBot = new Bot(token);

    // Query parameters check (e.g. ?action=info or ?action=delete or ?action=test_send)
    const urlObj = new URL(req.url || '/', `${protocol}://${host}`);
    const action = urlObj.searchParams.get('action') || 'set';

    if (action === 'info') {
      const info = await liveBot.api.getWebhookInfo();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, webhookInfo: info }, null, 2));
      return;
    }

    if (action === 'delete') {
      await liveBot.api.deleteWebhook({ drop_pending_updates: true });
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, message: 'Webhook deleted successfully' }, null, 2));
      return;
    }

    if (action === 'test_send') {
      const adminChatId = parseInt(process.env.ADMIN_CHAT_ID || '0', 10);
      if (!adminChatId) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: 'ADMIN_CHAT_ID is not configured in Vercel.' }));
        return;
      }

      const msg = await liveBot.api.sendMessage(
        adminChatId,
        '🧪 <b>Test message from Vercel</b>: Bot is connected to your support group!',
        { parse_mode: 'HTML' }
      );

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, message: 'Test message sent to admin chat!', messageDetails: msg }, null, 2));
      return;
    }

    // Default: Set webhook with clean updates drop
    await liveBot.api.setWebhook(webhookUrl, {
      drop_pending_updates: true,
      allowed_updates: ['message', 'edited_message', 'callback_query'],
    });

    // Automatically configure Welcome Description & Menu Commands on Telegram
    try {
      await liveBot.api.setMyDescription(
        '👋 សួស្តី! សូមស្វាគមន៍មកកាន់សេវាបម្រើអតិថិជន NSSF SOC Support។\n\n' +
        'លោកអ្នកអាចផ្ញើសំណួរ បញ្ហា ឬឯកសារផ្សេងៗនៅទីនេះ ដើម្បីទទួលបានការឆ្លើយតបពីក្រុមការងាររបស់យើងខ្ញុំ។\n\n' +
        '👉 សូមចុចប៊ូតុង Start ខាងក្រោមដើម្បីចាប់ផ្តើម!\n\n' +
        '---\n' +
        'Welcome to NSSF SOC Live Support. Please click Start to chat with our team.'
      );

      await liveBot.api.setMyShortDescription('សេវាបម្រើអតិថិជន NSSF SOC Live Chat Support');

      await liveBot.api.setMyCommands([
        { command: 'start', description: 'ចាប់ផ្តើមសន្ទនា / Start Support' },
        { command: 'help', description: 'ជំនួយ និងព័ត៌មាន / Help' },
        { command: 'id', description: 'លេខសម្គាល់ / Show Chat ID' },
      ]);
    } catch (e) {
      logger.warn('Could not update bot description/commands:', e);
    }

    const info = await liveBot.api.getWebhookInfo();
    const me = await liveBot.api.getMe();

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify(
        {
          success: true,
          message: `Webhook and Welcome Description configured for @${me.username}!`,
          bot: {
            id: me.id,
            username: me.username,
            firstName: me.first_name,
          },
          webhookInfo: info,
        },
        null,
        2
      )
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to set webhook:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify(
        {
          success: false,
          error: message,
        },
        null,
        2
      )
    );
  }
}
