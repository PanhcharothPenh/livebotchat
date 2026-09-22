import { Context } from 'grammy';
import {
  translations,
  getRatingKeyboard,
  getFeedbackCategoriesKeyboard,
  getAdminTicketClosedKeyboard,
  getUserBottomKeyboard,
} from '../utils/i18n.js';
import { UserService } from '../services/userService.js';
import { TicketService } from '../services/ticketService.js';
import { RelayService } from '../services/relayService.js';
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
      await ctx.reply(t.helpPrompt, {
        reply_markup: getUserBottomKeyboard(lang),
      });
      return;
    }

    // 2. Staff 1-Click Ticket Close: admin_close_<userId>_<ticketId>
    if (data.startsWith('admin_close_')) {
      const parts = data.split('_'); // ['admin', 'close', userId, ticketId]
      const targetUserId = parseInt(parts[2], 10);
      const ticketId = parts[3] || 'general';

      if (!targetUserId) {
        await ctx.answerCallbackQuery({ text: '⚠️ Invalid user ID' });
        return;
      }

      await TicketService.closeOpenTicket(targetUserId);

      // Send 5-star rating to customer
      const userRecord = await UserService.getUser(targetUserId);
      const lang = userRecord?.language || 'km';
      const t = translations[lang] || translations.km;

      try {
        await ctx.api.sendMessage(targetUserId, `${t.ticketClosed}\n\n${t.ratingPrompt}`, {
          reply_markup: getRatingKeyboard(ticketId),
        });
      } catch (err) {
        logger.warn(`Could not send survey to user ${targetUserId}:`, err);
      }

      // Update button on the header card to show who closed it
      const staffName = `${ctx.from?.first_name || ''} ${ctx.from?.last_name || ''}`.trim() || ctx.from?.username || 'Staff';
      await ctx.editMessageReplyMarkup({
        reply_markup: getAdminTicketClosedKeyboard(staffName),
      }).catch(() => {});

      await ctx.answerCallbackQuery({ text: `✅ បានបញ្ចប់ការសន្ទនាដោយ ${staffName}` });
      return;
    }

    // 3. Staff 1-Click User Info: admin_info_<userId>
    if (data.startsWith('admin_info_')) {
      const targetUserId = parseInt(data.replace('admin_info_', ''), 10);
      if (!targetUserId) {
        await ctx.answerCallbackQuery({ text: '⚠️ Invalid user ID' });
        return;
      }

      const userRecord = await UserService.getUser(targetUserId);
      const msgCount = await RelayService.getUserMessageCount(targetUserId);

      const infoText = userRecord
        ? `👤 ឈ្មោះ: ${userRecord.first_name || ''} ${userRecord.last_name || ''}\n` +
          `🆔 ID: ${userRecord.id}\n` +
          `🌐 Username: ${userRecord.username ? '@' + userRecord.username : 'None'}\n` +
          `🗣 ភាសា: ${userRecord.language === 'en' ? 'English' : 'ខ្មែរ'}\n` +
          `💬 សារសរុប: ${msgCount}`
        : `❌ រកមិនឃើញទិន្នន័យសម្រាប់ ID ${targetUserId}`;

      await ctx.answerCallbackQuery({ text: infoText, show_alert: true });
      return;
    }

    // 4. Rating Submission: rate_<ticketId>_<stars>
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

    // 5. Feedback Category Submission: fb_<ticketId>_<category>
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

    // Noop button clicked
    if (data === 'admin_noop') {
      await ctx.answerCallbackQuery({ text: '✅ ការសន្ទនានេះត្រូវបានបញ្ចប់រួចរាល់ហើយ' });
      return;
    }
  } catch (err) {
    logger.error('Error handling callback query:', err);
    await ctx.answerCallbackQuery().catch(() => {});
  }
}
