import { Context } from 'grammy';
import { config } from '../config.js';
import { UserService } from '../services/userService.js';
import { TicketService } from '../services/ticketService.js';
import { RelayService } from '../services/relayService.js';
import { logger } from '../utils/logger.js';

function getAdminChatId(): number {
  return parseInt(process.env.ADMIN_CHAT_ID || String(config.adminChatId), 10);
}

export async function handleUserMessage(ctx: Context) {
  if (!ctx.from || !ctx.message || ctx.chat?.type !== 'private') {
    return;
  }

  const user = ctx.from;
  const userMessageId = ctx.message.message_id;
  const adminChatId = getAdminChatId();

  if (!adminChatId || adminChatId === 0) {
    logger.error('ADMIN_CHAT_ID is not configured in environment variables.');
    return;
  }

  // 1. Check if user is banned
  const isBanned = await UserService.isUserBanned(user.id);
  if (isBanned) {
    logger.warn(`Ignored message from banned user ${user.id} (${user.first_name})`);
    return;
  }

  // 2. Sync user profile with Supabase
  await UserService.syncUser({
    id: user.id,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
  });

  // 3. Get or create active support ticket
  const ticket = await TicketService.getOrCreateOpenTicket(user.id);
  const ticketId = ticket?.id || null;

  // 4. Determine content type and text preview for database logging
  let contentType = 'unknown';
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
  } else if (ctx.message.location) {
    contentType = 'location';
    textContent = `Lat: ${ctx.message.location.latitude}, Long: ${ctx.message.location.longitude}`;
  } else if (ctx.message.contact) {
    contentType = 'contact';
    textContent = `Contact: ${ctx.message.contact.first_name} (${ctx.message.contact.phone_number})`;
  }

  try {
    // 5. Send User Header Card in Admin Group to clearly show sender details
    const userDisplay = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Anonymous';
    const usernameDisplay = user.username ? `@${user.username}` : 'No username';
    const ticketShortId = ticketId ? ticketId.substring(0, 8) : 'N/A';

    const headerText = 
      `📩 <b>Message from User</b>\n` +
      `👤 <b>Name:</b> ${userDisplay} (${usernameDisplay})\n` +
      `🆔 <b>User ID:</b> <code>${user.id}</code>\n` +
      `🎫 <b>Ticket:</b> <code>#${ticketShortId}</code>\n` +
      `<i>💡 Reply to this card or the message below to respond to the user.</i>`;

    const headerMsg = await ctx.api.sendMessage(adminChatId, headerText, { parse_mode: 'HTML' });

    // 6. Copy the exact user message into Admin Group
    const adminRelayMsg = await ctx.api.copyMessage(
      adminChatId,
      ctx.chat.id,
      userMessageId
    );

    // 7. Store BOTH header card ID and relayed message ID in Supabase
    await Promise.all([
      RelayService.recordMessage({
        ticket_id: ticketId,
        user_id: user.id,
        sender_type: 'system',
        user_message_id: userMessageId,
        admin_message_id: headerMsg.message_id,
        content_type: 'header',
        text_content: headerText,
        media_file_id: null,
      }),
      RelayService.recordMessage({
        ticket_id: ticketId,
        user_id: user.id,
        sender_type: 'user',
        user_message_id: userMessageId,
        admin_message_id: adminRelayMsg.message_id,
        content_type: contentType,
        text_content: textContent,
        media_file_id: mediaFileId,
      }),
    ]);

    logger.info(`Relayed message from user ${user.id} to admin chat (Header: ${headerMsg.message_id}, Relay: ${adminRelayMsg.message_id})`);
  } catch (err) {
    logger.error(`Failed to forward message from user ${user.id} to admin group:`, err);
    await ctx.reply('⚠️ Sorry, there was an issue delivering your message to our support team. Please try again shortly.').catch(() => {});
  }
}
