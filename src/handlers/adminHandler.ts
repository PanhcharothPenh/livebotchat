import { Context } from 'grammy';
import { config } from '../config.js';
import { translations } from '../utils/i18n.js';
import { UserService } from '../services/userService.js';
import { RelayService } from '../services/relayService.js';
import { StaffService } from '../services/staffService.js';
import { logger } from '../utils/logger.js';

function getAdminChatId(): number {
  return parseInt(process.env.ADMIN_CHAT_ID || String(config.adminChatId), 10);
}

// Track the active staff member ID for each ticket/user
export const activeTicketStaff = new Map<string, number>();

export async function handleAdminReply(ctx: Context) {
  const adminChatId = getAdminChatId();
  if (!ctx.message || ctx.chat?.id !== adminChatId) {
    return;
  }

  const replyTo = ctx.message.reply_to_message;
  if (!replyTo) {
    // Regular admin group message (not a reply) - no action needed
    return;
  }

  // 1. Check if the message being replied to was a relayed message or header card in Supabase
  const messageRecord = await RelayService.findMessageByAdminMsgId(replyTo.message_id);

  let targetUserId: number | null = messageRecord?.user_id || null;
  let ticketId = messageRecord?.ticket_id || null;

  // 2. Fallback: Parse User ID directly from header card text (supports Khmer & English)
  if (!targetUserId && (replyTo.text || replyTo.caption)) {
    const fullText = replyTo.text || replyTo.caption || '';
    const match = 
      fullText.match(/លេខសម្គាល់អ្នកប្រើប្រាស់:\s*([0-9]+)/i) ||
      fullText.match(/User ID:\s*([0-9]+)/i) ||
      fullText.match(/ID:\s*([0-9]+)/i);

    if (match) {
      targetUserId = parseInt(match[1], 10);
    }
  }

  if (!targetUserId) {
    logger.debug(`Reply was not to a tracked user message (reply_to_id: ${replyTo.message_id})`);
    return;
  }

  const adminMsgId = ctx.message.message_id;
  const activeTicketKey = ticketId || `user_${targetUserId}`;
  const staffUserId = ctx.from?.id || 0;

  // 3. Resolve custom Khmer staff name from web CRUD database, falling back to Telegram profile
  const customStaff = await StaffService.getStaff(ctx.from?.username, ctx.from?.id);
  const agentFullName = customStaff?.display_name_km
    ? customStaff.display_name_km
    : ctx.from
    ? `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim() || ctx.from.first_name || ctx.from.username || 'ក្រុមការងារ NSSF SOC'
    : 'ក្រុមការងារ NSSF SOC';

  // 4. Send "Live Agent [Full Name] is connected" if this is the first reply or a NEW/DIFFERENT staff member is replying
  const lastStaffUserId = activeTicketStaff.get(activeTicketKey);
  if (lastStaffUserId !== staffUserId) {
    activeTicketStaff.set(activeTicketKey, staffUserId);
    try {
      const userRecord = await UserService.getUser(targetUserId);
      const lang = userRecord?.language || 'km';
      const t = translations[lang] || translations.km;
      await ctx.api.sendMessage(targetUserId, t.agentConnected(agentFullName), { parse_mode: 'HTML' });
    } catch (err) {
      logger.debug('Could not send agent connected notice:', err);
    }
  }

  // 5. Extract content preview for logging
  let contentType = 'text';
  let textContent: string | null = null;
  let mediaFileId: string | null = null;

  if (ctx.message.text) {
    contentType = 'text';
    textContent = ctx.message.text;
  } else if (ctx.message.photo) {
    contentType = 'photo';
    textContent = ctx.message.caption || null;
    mediaFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
  } else if (ctx.message.voice) {
    contentType = 'voice';
    textContent = ctx.message.caption || null;
    mediaFileId = ctx.message.voice.file_id;
  } else if (ctx.message.document) {
    contentType = 'document';
    textContent = ctx.message.caption || null;
    mediaFileId = ctx.message.document.file_id;
  } else if (ctx.message.sticker) {
    contentType = 'sticker';
    mediaFileId = ctx.message.sticker.file_id;
  } else if (ctx.message.video) {
    contentType = 'video';
    textContent = ctx.message.caption || null;
    mediaFileId = ctx.message.video.file_id;
  } else if (ctx.message.audio) {
    contentType = 'audio';
    textContent = ctx.message.caption || null;
    mediaFileId = ctx.message.audio.file_id;
  } else if (ctx.message.video_note) {
    contentType = 'video_note';
    mediaFileId = ctx.message.video_note.file_id;
  }

  try {
    // 6. Copy the admin's reply message directly to the customer's private chat
    const sentToUser = await ctx.api.copyMessage(
      targetUserId,
      adminChatId,
      adminMsgId
    );

    // 7. Save admin message in Supabase
    await RelayService.recordMessage({
      ticket_id: ticketId,
      user_id: targetUserId,
      sender_type: 'admin',
      user_message_id: sentToUser.message_id,
      admin_message_id: adminMsgId,
      content_type: contentType,
      text_content: textContent,
      media_file_id: mediaFileId,
    });

    logger.info(`Relayed admin reply from ${agentFullName} to user ${targetUserId}`);

    // Optional: React to admin message to confirm delivery
    try {
      await ctx.react('👍');
    } catch {
      // Reactions might not be supported in some group types, ignore safely
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to send reply to user ${targetUserId}:`, err);

    if (errorMsg.includes('bot was blocked by the user')) {
      await ctx.reply(`⚠️ Cannot deliver reply: User <code>${targetUserId}</code> has blocked the bot.`, {
        parse_mode: 'HTML',
        reply_parameters: { message_id: adminMsgId },
      });
    } else {
      await ctx.reply(`❌ Failed to deliver message to user: ${errorMsg}`, {
        reply_parameters: { message_id: adminMsgId },
      });
    }
  }
}
