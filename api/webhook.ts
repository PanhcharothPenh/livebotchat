import type { IncomingMessage, ServerResponse } from 'http';
import { webhookCallback } from 'grammy';
import { getBot } from '../src/bot.js';
import { logger } from '../src/utils/logger.js';

let _cachedHandler: ((req: IncomingMessage, res: ServerResponse) => Promise<void>) | null = null;
let _cachedToken = '';

export default async function (req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', message: 'Telegram Bot Webhook is running' }));
    return;
  }

  try {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!token) {
      logger.error('TELEGRAM_BOT_TOKEN is missing in environment variables');
      res.statusCode = 500;
      res.end('Missing TELEGRAM_BOT_TOKEN');
      return;
    }

    // Lazy load and cache the webhook handler for this instance
    if (!_cachedHandler || _cachedToken !== token) {
      _cachedToken = token;
      const bot = getBot(token);
      _cachedHandler = webhookCallback(bot, 'http', {
        timeoutMilliseconds: 15000,
      });
    }

    await _cachedHandler(req, res);
  } catch (err) {
    logger.error('Error handling webhook update:', err);
    if (!res.headersSent) {
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
  }
}
