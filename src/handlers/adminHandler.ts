import { Context } from 'grammy';
import { config } from '../config.js';
import { RelayService } from '../services/relayService.js';
import { logger } from '../utils/logger.js';

export async function handleAdminReply(ctx: Context) {
  if (!ctx.message || ctx.chat?.id !== config.adminChatId) {
    return;
  }

  const replyTo = ctx.message.reply_to_message;
  if (!replyTo) {
    // Regular admin group message (not a reply) - no action needed
    return;
  }

  // 1. Check if the message being replied to was a relayed message stored in Supabase
  const messageRecord = await RelayService.findMessageByAdminMsgId(replyTo.message_id);

  if (!messageRecord) {
    // Might be replying to an internal admin message or older message
    return;
  }

  const targetUserId = messageRecord.user_id;
  const adminMsgId = ctx.message.message_id;

  // 2. Extract content preview for logging
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
    // 3. Copy the admin's reply message directly to the customer's private chat
    const sentToUser = await ctx.api.copyMessage(
      targetUserId,
      config.adminChatId,
      adminMsgId
    );

    // 4. Save admin message in Supabase
    await RelayService.recordMessage({
      ticket_id: messageRecord.ticket_id,
      user_id: targetUserId,
      sender_type: 'admin',
      user_message_id: sentToUser.message_id,
      admin_message_id: adminMsgId,
      content_type: contentType,
      text_content: textContent,
      media_file_id: mediaFileId,
    });

    logger.info(`Relayed admin reply to user ${targetUserId}`);

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
