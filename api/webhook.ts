import type { IncomingMessage, ServerResponse } from 'http';
import { webhookCallback } from 'grammy';
import { bot } from '../src/bot.js';
import { config } from '../src/config.js';
import { logger } from '../src/utils/logger.js';

// Create the webhook handler
const handler = webhookCallback(bot, 'http', {
  secretToken: config.webhookSecret,
  timeoutMilliseconds: 10000,
});

export default async function (req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', message: 'Telegram Bot Webhook is active' }));
    return;
  }

  try {
    await handler(req, res);
  } catch (err) {
    logger.error('Error handling webhook update:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  }
}
