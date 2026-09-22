import type { IncomingMessage, ServerResponse } from 'http';
import { bot } from '../src/bot.js';
import { config } from '../src/config.js';
import { logger } from '../src/utils/logger.js';

export default async function (req: IncomingMessage, res: ServerResponse) {
  try {
    const host = req.headers.host || 'localhost';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const webhookUrl = `${protocol}://${host}/api/webhook`;

    // Query parameters check (e.g. ?action=info or ?action=set)
    const urlObj = new URL(req.url || '/', `${protocol}://${host}`);
    const action = urlObj.searchParams.get('action') || 'set';

    if (action === 'info') {
      const info = await bot.api.getWebhookInfo();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, webhookInfo: info }, null, 2));
      return;
    }

    if (action === 'delete') {
      await bot.api.deleteWebhook({ drop_pending_updates: false });
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: true, message: 'Webhook deleted successfully' }, null, 2));
      return;
    }

    // Default: Set webhook
    await bot.api.setWebhook(webhookUrl, {
      secret_token: config.webhookSecret,
      allowed_updates: ['message', 'edited_message', 'callback_query'],
    });

    const info = await bot.api.getWebhookInfo();

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify(
        {
          success: true,
          message: `Webhook successfully configured for ${webhookUrl}`,
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
    res.end(JSON.stringify({ success: false, error: message }, null, 2));
  }
}
