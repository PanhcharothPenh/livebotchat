import { Context } from 'grammy';
import { config } from '../config.js';
import { UserService } from '../services/userService.js';
import { TicketService } from '../services/ticketService.js';
import { RelayService } from '../services/relayService.js';
import { logger } from '../utils/logger.js';

function isAdmin(ctx: Context): boolean {
  return ctx.chat?.id === config.adminChatId || ctx.from?.id === config.adminChatId;
}

export const commandHandlers = {
  /**
   * /start - Welcome message for users
   */
  async start(ctx: Context) {
    if (!ctx.from) return;

    if (ctx.chat?.type === 'private') {
      await UserService.syncUser({
        id: ctx.from.id,
        username: ctx.from.username,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name,
      });

      await ctx.reply(config.welcomeMessage, { parse_mode: 'HTML' });
    } else if (isAdmin(ctx)) {
      await ctx.reply('🤖 <b>Support Bot Admin Console Ready.</b>\nType /help to see available admin commands.', {
        parse_mode: 'HTML',
      });
    }
  },

  /**
   * /help - Command list
   */
  async help(ctx: Context) {
    if (isAdmin(ctx)) {
      const helpText = 
        `🛠 <b>Admin Commands:</b>\n\n` +
        `• <b>Reply to any user message</b> to send them a direct reply.\n` +
        `• <code>/close</code> - Reply to a user's message with /close (or <code>/close &lt;user_id&gt;</code>) to mark their ticket resolved.\n` +
        `• <code>/info &lt;user_id&gt;</code> - View user info & message count (or reply to a message with /info).\n` +
        `• <code>/ban &lt;user_id&gt;</code> - Ban user from sending messages.\n` +
        `• <code>/unban &lt;user_id&gt;</code> - Unban user.\n` +
        `• <code>/stats</code> - View bot metrics & open tickets.\n` +
        `• <code>/broadcast &lt;message&gt;</code> - Send message to all active users.`;
      await ctx.reply(helpText, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(
        '💬 Send any message, photo, or question to this chat and our support team will get back to you!'
      );
    }
  },

  /**
   * /close - Close active support ticket
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

      await TicketService.closeOpenTicket(targetUserId);

      // Notify user
      try {
        await ctx.api.sendMessage(targetUserId, config.ticketClosedMessage);
      } catch (err) {
        logger.warn(`Could not notify user ${targetUserId} of closed ticket:`, err);
      }

      await ctx.reply(`✅ Ticket for user <code>${targetUserId}</code> has been marked as closed.`, {
        parse_mode: 'HTML',
      });
    } else if (ctx.chat?.type === 'private') {
      // User closing their own ticket
      targetUserId = ctx.from.id;
      await TicketService.closeOpenTicket(targetUserId);
      await ctx.reply(config.ticketClosedMessage);
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
      `🚫 <b>Status:</b> ${user.is_banned ? '🔴 Banned' : '🟢 Active'}\n` +
      `💬 <b>Total Messages:</b> ${msgCount}\n` +
      `🕒 <b>First Seen:</b> ${user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A'}\n` +
      `🕒 <b>Last Seen:</b> ${user.last_seen_at ? new Date(user.last_seen_at).toLocaleString() : 'N/A'}`;

    await ctx.reply(infoText, { parse_mode: 'HTML' });
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

    await ctx.reply(statsText, { parse_mode: 'HTML' });
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
        // Small delay to respect Telegram rate limits
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (err) {
        failed++;
        logger.debug(`Failed broadcast to ${user.id}:`, err);
      }
    }

    await ctx.reply(`🏁 <b>Broadcast Finished</b>\n✅ Delivered: ${sent}\n❌ Failed (Blocked/Deleted): ${failed}`, {
      parse_mode: 'HTML',
    });
  },
};
