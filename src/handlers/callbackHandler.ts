import { Context } from 'grammy';
import { translations, getFeedbackCategoriesKeyboard } from '../utils/i18n.js';
import { UserService } from '../services/userService.js';
import { TicketService } from '../services/ticketService.js';
import { logger } from '../utils/logger.js';

export async function handleCallbackQuery(ctx: Context) {
  const data = ctx.callbackQuery?.data;
  const user = ctx.from;
  if (!data || !user) return;

  try {
    // 1. Language Selection: lang_km or lang_en
    if (data.startsWith('lang_')) {
      const lang = data.replace('lang_', '');
      await UserService.setUserLanguage(user.id, lang);
      await ctx.answerCallbackQuery();

      const t = translations[lang] || translations.km;
      await ctx.reply(t.helpPrompt);
      return;
    }

    // 2. Rating Submission: rate_<ticketId>_<stars>
    if (data.startsWith('rate_')) {
      const parts = data.split('_'); // ['rate', ticketId, stars]
      const ticketId = parts[1];
      const stars = parseInt(parts[2], 10) || 5;

      await TicketService.rateTicket(ticketId, stars);
      await ctx.answerCallbackQuery({ text: `⭐️ Rated ${stars}/5` });

      const userRecord = await UserService.getUser(user.id);
      const lang = userRecord?.language || 'km';
      const t = translations[lang] || translations.km;

      await ctx.reply(t.feedbackOptionsPrompt, {
        reply_markup: getFeedbackCategoriesKeyboard(ticketId, lang),
      });
      return;
    }

    // 3. Feedback Category Submission: fb_<ticketId>_<category>
    if (data.startsWith('fb_')) {
      const parts = data.split('_'); // ['fb', ticketId, category]
      const ticketId = parts[1];
      const category = parts[2];

      await TicketService.rateTicket(ticketId, 5, category);
      await ctx.answerCallbackQuery({ text: '✅ Feedback received' });

      const userRecord = await UserService.getUser(user.id);
      const lang = userRecord?.language || 'km';
      const t = translations[lang] || translations.km;

      await ctx.reply(t.feedbackThanks);
      return;
    }
  } catch (err) {
    logger.error('Error handling callback query:', err);
    await ctx.answerCallbackQuery().catch(() => {});
  }
}
