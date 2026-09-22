import type { IncomingMessage, ServerResponse } from 'http';
import { getBot } from '../src/bot.js';
import { logger } from '../src/utils/logger.js';

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

    const bot = getBot(token);

    // Initialize bot info if not already done
    if (!bot.isInited()) {
      await bot.init();
    }

    // Read update body
    let updateData: unknown = req.body;

    if (typeof updateData === 'string') {
      try {
        updateData = JSON.parse(updateData);
      } catch {
        // Leave as string
      }
    }

    if (!updateData) {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const rawText = Buffer.concat(chunks).toString('utf-8');
      if (rawText) {
        updateData = JSON.parse(rawText);
      }
    }

    if (updateData && typeof updateData === 'object') {
      await bot.handleUpdate(updateData as any);
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    logger.error('Error handling webhook update:', err);
    if (!res.headersSent) {
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: false, error: String(err) }));
    }
  }
}
