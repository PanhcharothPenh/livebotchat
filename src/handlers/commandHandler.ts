import { Context } from 'grammy';
import { config } from '../config.js';
import {
  translations,
  getLanguageKeyboard,
  getRatingKeyboard,
  getAdminBottomKeyboard,
} from '../utils/i18n.js';
import { UserService } from '../services/userService.js';
import { TicketService } from '../services/ticketService.js';
import { RelayService } from '../services/relayService.js';
import { activeTicketStaff } from './adminHandler.js';
import { logger } from '../utils/logger.js';

function getAdminChatId(): number {
  return parseInt(process.env.ADMIN_CHAT_ID || String(config.adminChatId), 10);
}

function isAdmin(ctx: Context): boolean {
  const adminChatId = getAdminChatId();
  return ctx.chat?.id === adminChatId || ctx.from?.id === adminChatId;
}

export const commandHandlers = {
  /**
   * /id - Get current chat and user ID easily
   */
  async id(ctx: Context) {
    if (!ctx.chat) return;
    const title = (ctx.chat as any).title || `${ctx.from?.first_name || 'Private Chat'}`;
    const idText = 
      `📍 <b>Chat Info:</b>\n\n` +
      `📛 <b>Name:</b> ${title}\n` +
      `🆔 <b>Chat ID:</b> <code>${ctx.chat.id}</code>\n` +
      `📁 <b>Type:</b> ${ctx.chat.type}\n\n` +
      `<i>👉 If this is your Support Group, copy <code>${ctx.chat.id}</code> into <b>ADMIN_CHAT_ID</b> on Vercel!</i>`;

    const keyboard = isAdmin(ctx) ? getAdminBottomKeyboard() : undefined;
    await ctx.reply(idText, { parse_mode: 'HTML', reply_markup: keyboard }).catch(() => {
      ctx.reply(`Chat ID: ${ctx.chat?.id}`);
    });
  },

  /**
   * /start - Welcome message + Interactive Language Selector
   */
  async start(ctx: Context) {
    if (!ctx.from) return;

    if (ctx.chat?.type === 'private') {
      try {
        await UserService.syncUser({
          id: ctx.from.id,
          username: ctx.from.username,
          first_name: ctx.from.first_name,
          last_name: ctx.from.last_name,
        });
      } catch (err) {
        logger.error('Failed to sync user on /start:', err);
      }

      // Send Exact Custom Welcome Greeting with Language Selector
      const welcomeText = 
        `សួស្តី! សូមស្វាគមន៍មកកាន់ <b>ក្រុមការងារ NSSF SOC</b>\n` +
        `Hi! Welcome to <b>NSSF SOC Support</b>\n\n` +
        `សូមជ្រើសរើសភាសា / Please select a language:`;

      await ctx.reply(welcomeText, {
        parse_mode: 'HTML',
        reply_markup: getLanguageKeyboard(),
      }).catch(() => {});
    } else if (isAdmin(ctx)) {
      await ctx.reply('🤖 <b>Support Bot Admin Console Ready.</b>\nType /help to see available admin commands.', {
        parse_mode: 'HTML',
        reply_markup: getAdminBottomKeyboard(),
      }).catch(() => {});
    }
  },

  /**
   * /help - Command list
   */
  async help(ctx: Context) {
    if (isAdmin(ctx)) {
      const helpText = 
        `🛠 <b>របៀបប្រើប្រាស់សម្រាប់ក្រុមការងារ (Admin Guide):</b>\n\n` +
        `• <b>ឆ្លើយតបទៅកាន់អតិថិជន:</b> ចុច <code>Reply</code> លើសាររបស់អតិថិជនដើម្បីផ្ញើសារត្រឡប់ទៅវិញ។\n` +
        `• <b>បញ្ចប់ការសន្ទនា:</b> ចុចប៊ូតុង <code>🔴 បញ្ចប់ការសន្ទនា</code> ឬវាយ <code>/close</code>។\n` +
        `• <b>មើលព័ត៌មានអតិថិជន:</b> ចុចប៊ូតុង <code>ℹ️ ព័ត៌មាន</code> ឬវាយ <code>/info &lt;user_id&gt;</code>។\n` +
        `• <code>/ban &lt;user_id&gt;</code> - បិទគណនីស្ពែម (Ban user)\n` +
        `• <code>/unban &lt;user_id&gt;</code> - បើកគណនីឡើងវិញ (Unban user)\n` +
        `• <code>/stats</code> - មើលចំនួនអ្នកប្រើប្រាស់ និងសំណើទាំងអស់\n` +
        `• <code>/broadcast &lt;message&gt;</code> - ផ្ញើសារប្រកាសទៅកាន់អ្នកប្រើប្រាស់ទាំងអស់`;
      await ctx.reply(helpText, { parse_mode: 'HTML', reply_markup: getAdminBottomKeyboard() }).catch(() => {});
    } else {
      await ctx.reply(
        '💬 សូមផ្ញើសារ រូបភាព ឬសំណួររបស់អ្នកនៅទីនេះ ក្រុមការងារយើងនឹងឆ្លើយតបជូនភ្លាមៗ!\n\nSend any message, photo, or question here and our support team will assist you.',
        { reply_markup: { remove_keyboard: true } }
      ).catch(() => {});
    }
  },

  /**
   * /close - Close active ticket and trigger CSAT rating
   */
  async close(ctx: Context) {
    if (!ctx.from) return;

    let targetUserId: number | null = null;

    if (isAdmin(ctx)) {
      // Check if replied to a message
      const replyTo = ctx.message?.reply_to_message;
      if (replyTo) {
        const record = await RelayService.findMessageByAdminMsgId(replyTo.message_id);
        if (record) targetUserId = record.user_id;
      }

      // Or parsed from command argument: /close 123456
      if (!targetUserId && ctx.match) {
        const parsed = parseInt(String(ctx.match).trim(), 10);
        if (!isNaN(parsed)) targetUserId = parsed;
      }

      if (!targetUserId) {
        await ctx.reply('⚠️ Please reply to a customer message with <code>/close</code> or specify user ID: <code>/close &lt;user_id&gt;</code>', {
          parse_mode: 'HTML',
        });
        return;
      }

      const closedTicket = await TicketService.closeOpenTicket(targetUserId);
      const ticketId = closedTicket?.id || 'general';

      // Reset active staff tracker for this session
      activeTicketStaff.delete(ticketId);
      activeTicketStaff.delete(`user_${targetUserId}`);

      const userRecord = await UserService.getUser(targetUserId);
      const lang = userRecord?.language || 'km';
      const t = translations[lang] || translations.km;

      // Send Rating Survey to customer
      try {
        await ctx.api.sendMessage(targetUserId, `${t.ticketClosed}\n\n${t.ratingPrompt}`, {
          reply_markup: getRatingKeyboard(ticketId),
        });
      } catch (err) {
        logger.warn(`Could not notify user ${targetUserId} of closed ticket:`, err);
      }

      await ctx.reply(`✅ Ticket for user <code>${targetUserId}</code> has been closed and survey sent.`, {
        parse_mode: 'HTML',
        reply_markup: getAdminBottomKeyboard(),
      });
    } else if (ctx.chat?.type === 'private') {
      targetUserId = ctx.from.id;
      const closedTicket = await TicketService.closeOpenTicket(targetUserId);
      const ticketId = closedTicket?.id || 'general';

      const userRecord = await UserService.getUser(targetUserId);
      const lang = userRecord?.language || 'km';
      const t = translations[lang] || translations.km;

      await ctx.reply(`${t.ticketClosed}\n\n${t.ratingPrompt}`, {
        reply_markup: getRatingKeyboard(ticketId),
      }).catch(() => {});
    }
  },

  /**
   * /ban <user_id>
   */
  async ban(ctx: Context) {
    if (!isAdmin(ctx)) return;

    let targetUserId: number | null = null;
    const replyTo = ctx.message?.reply_to_message;
    if (replyTo) {
      const record = await RelayService.findMessageByAdminMsgId(replyTo.message_id);
      if (record) targetUserId = record.user_id;
    }

    if (!targetUserId && ctx.match) {
      const parsed = parseInt(String(ctx.match).trim(), 10);
      if (!isNaN(parsed)) targetUserId = parsed;
    }

    if (!targetUserId) {
      await ctx.reply('⚠️ Please specify a user ID: <code>/ban &lt;user_id&gt;</code> or reply to their message with /ban', {
        parse_mode: 'HTML',
      });
      return;
    }

    await UserService.setBanStatus(targetUserId, true);
    await TicketService.closeOpenTicket(targetUserId);
    await ctx.reply(`🚫 User <code>${targetUserId}</code> has been banned from support.`, {
      parse_mode: 'HTML',
      reply_markup: getAdminBottomKeyboard(),
    });
  },

  /**
   * /unban <user_id>
   */
  async unban(ctx: Context) {
    if (!isAdmin(ctx)) return;

    let targetUserId: number | null = null;
    if (ctx.match) {
      const parsed = parseInt(String(ctx.match).trim(), 10);
      if (!isNaN(parsed)) targetUserId = parsed;
    }

    if (!targetUserId) {
      await ctx.reply('⚠️ Please specify a user ID: <code>/unban &lt;user_id&gt;</code>', {
        parse_mode: 'HTML',
      });
      return;
    }

    await UserService.setBanStatus(targetUserId, false);
    await ctx.reply(`✅ User <code>${targetUserId}</code> has been unbanned.`, {
      parse_mode: 'HTML',
      reply_markup: getAdminBottomKeyboard(),
    });
  },

  /**
   * /info <user_id>
   */
  async info(ctx: Context) {
    if (!isAdmin(ctx)) return;

    let targetUserId: number | null = null;
    const replyTo = ctx.message?.reply_to_message;
    if (replyTo) {
      const record = await RelayService.findMessageByAdminMsgId(replyTo.message_id);
      if (record) targetUserId = record.user_id;
    }

    if (!targetUserId && ctx.match) {
      const parsed = parseInt(String(ctx.match).trim(), 10);
      if (!isNaN(parsed)) targetUserId = parsed;
    }

    if (!targetUserId) {
      await ctx.reply('⚠️ Please specify a user ID: <code>/info &lt;user_id&gt;</code> or reply to a message.', {
        parse_mode: 'HTML',
      });
      return;
    }

    const user = await UserService.getUser(targetUserId);
    const msgCount = await RelayService.getUserMessageCount(targetUserId);

    if (!user) {
      await ctx.reply(`❌ No record found for user ID <code>${targetUserId}</code>.`, {
        parse_mode: 'HTML',
      });
      return;
    }

    const infoText = 
      `📋 <b>User Information</b>\n\n` +
      `🆔 <b>ID:</b> <code>${user.id}</code>\n` +
      `👤 <b>Name:</b> ${user.first_name || ''} ${user.last_name || ''}\n` +
      `🌐 <b>Username:</b> ${user.username ? '@' + user.username : 'None'}\n` +
      `🗣 <b>Language:</b> ${user.language === 'en' ? '🇬🇧 English' : '🇰🇭 ខ្មែរ'}\n` +
      `🚫 <b>Status:</b> ${user.is_banned ? '🔴 Banned' : '🟢 Active'}\n` +
      `💬 <b>Total Messages:</b> ${msgCount}\n` +
      `🕒 <b>First Seen:</b> ${user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}\n` +
      `🕒 <b>Last Seen:</b> ${user.last_seen_at ? new Date(user.last_seen_at).toLocaleString() : 'N/A'}`;

    await ctx.reply(infoText, { parse_mode: 'HTML', reply_markup: getAdminBottomKeyboard() });
  },

  /**
   * /stats - Overall statistics
   */
  async stats(ctx: Context) {
    if (!isAdmin(ctx)) return;

    const stats = await UserService.getStats();

    const statsText = 
      `📊 <b>Support Bot Statistics</b>\n\n` +
      `👥 <b>Total Users:</b> ${stats.totalUsers}\n` +
      `🎫 <b>Open Tickets:</b> ${stats.openTickets}\n` +
      `💬 <b>Total Relayed Messages:</b> ${stats.totalMessages}\n` +
      `🚫 <b>Banned Users:</b> ${stats.bannedUsers}`;

    await ctx.reply(statsText, { parse_mode: 'HTML', reply_markup: getAdminBottomKeyboard() });
  },

  /**
   * /broadcast <message>
   */
  async broadcast(ctx: Context) {
    if (!isAdmin(ctx)) return;

    const text = String(ctx.match || '').trim();
    if (!text) {
      await ctx.reply('⚠️ Please provide a message to broadcast:\n<code>/broadcast Your announcement here...</code>', {
        parse_mode: 'HTML',
      });
      return;
    }

    const users = await UserService.getAllActiveUsers();
    await ctx.reply(`📢 Starting broadcast to ${users.length} users...`);

    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        await ctx.api.sendMessage(user.id, text, { parse_mode: 'HTML' });
        sent++;
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (err) {
        failed++;
        logger.debug(`Failed broadcast to ${user.id}:`, err);
      }
    }

    await ctx.reply(`🏁 <b>Broadcast Finished</b>\n✅ Delivered: ${sent}\n❌ Failed (Blocked/Deleted): ${failed}`, {
      parse_mode: 'HTML',
      reply_markup: getAdminBottomKeyboard(),
    });
  },
};
