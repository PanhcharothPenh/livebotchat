import type { IncomingMessage, ServerResponse } from 'http';
import { webhookCallback } from 'grammy';
import { bot } from '../src/bot.js';
import { logger } from '../src/utils/logger.js';

// Setup webhook callback without strict secret requirement unless explicitly configured
const webhookSecret = process.env.WEBHOOK_SECRET?.trim();

const handler = webhookCallback(
  bot,
  'http',
  webhookSecret
    ? {
        secretToken: webhookSecret,
        timeoutMilliseconds: 10000,
      }
    : {
        timeoutMilliseconds: 10000,
      }
);

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
