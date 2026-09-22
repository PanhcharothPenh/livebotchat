import type { IncomingMessage, ServerResponse } from 'http';
import { Bot } from 'grammy';
import { bot } from '../src/bot.js';
import { config } from '../src/config.js';
import { logger } from '../src/utils/logger.js';

export default async function (req: IncomingMessage, res: ServerResponse) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN || config.telegramBotToken;

    if (!token || token.includes('dummy') || token.trim() === '') {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify(
          {
            success: false,
            error: 'TELEGRAM_BOT_TOKEN is missing or not set in Vercel Environment Variables. Please add TELEGRAM_BOT_TOKEN in Vercel Settings -> Environment Variables and Redeploy.',
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
    const liveBot = new Bot(token.trim());

    // Query parameters check (e.g. ?action=info or ?action=set)
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
      await liveBot.api.deleteWebhook({ drop_pending_updates: false });
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, message: 'Webhook deleted successfully' }, null, 2));
      return;
    }

    // Default: Set webhook
    const webhookSecret = process.env.WEBHOOK_SECRET || config.webhookSecret;
    await liveBot.api.setWebhook(webhookUrl, {
      secret_token: webhookSecret,
      allowed_updates: ['message', 'edited_message', 'callback_query'],
    });

    const info = await liveBot.api.getWebhookInfo();
    const me = await liveBot.api.getMe();

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify(
        {
          success: true,
          message: `Webhook successfully configured for @${me.username}!`,
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
          hint: 'Make sure TELEGRAM_BOT_TOKEN is correct and redeploy if you recently changed environment variables in Vercel.',
        },
        null,
        2
      )
    );
  }
}
