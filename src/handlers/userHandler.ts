import { Context } from 'grammy';
import { config } from '../config.js';
import { getAdminTicketActionKeyboard } from '../utils/i18n.js';
import { UserService } from '../services/userService.js';
import { TicketService } from '../services/ticketService.js';
import { RelayService } from '../services/relayService.js';
import { logger } from '../utils/logger.js';

function getAdminChatId(): number {
  return parseInt(process.env.ADMIN_CHAT_ID || String(config.adminChatId), 10);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
  const ticketId = ticket?.id || 'general';
  const ticketShortId = ticketId.substring(0, 8);

  // 4. Determine content type and text preview for database logging
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
  } else if (ctx.message.location) {
    contentType = 'location';
    textContent = `Lat: ${ctx.message.location.latitude}, Long: ${ctx.message.location.longitude}`;
  } else if (ctx.message.contact) {
    contentType = 'contact';
    textContent = `Contact: ${ctx.message.contact.first_name} (${ctx.message.contact.phone_number})`;
  }

  try {
    const userDisplay = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Anonymous';
    const usernameDisplay = user.username ? `@${user.username}` : 'No username';
    const actionKeyboard = getAdminTicketActionKeyboard(user.id, ticketId);

    let sentAdminMessageId: number;

    // 5. Case A: Text Message -> Merged into 1 unified Card
    if (ctx.message.text) {
      const formattedMessage = 
        `📩 <b>សារថ្មីពីអ្នកប្រើប្រាស់</b>\n\n` +
        `👤 <b>ឈ្មោះ:</b> ${userDisplay} (${usernameDisplay})\n` +
        `🆔 <b>លេខសម្គាល់អ្នកប្រើប្រាស់:</b> <code>${user.id}</code>\n` +
        `🎫 <b>លេខសំណើ:</b> <code>#${ticketShortId}</code>\n\n` +
        `💬 <b>សារ:</b>\n${escapeHtml(ctx.message.text)}\n\n` +
        `<i>💡 សូមចុច Reply លើសារនេះ ដើម្បីឆ្លើយតបទៅកាន់អ្នកប្រើប្រាស់។</i>`;

      const sentMsg = await ctx.api.sendMessage(adminChatId, formattedMessage, {
        parse_mode: 'HTML',
        reply_markup: actionKeyboard,
      });
      sentAdminMessageId = sentMsg.message_id;
    }
    // Case B: Media with Caption support (Photo, Video, Document, Voice, Audio)
    else if (ctx.message.photo || ctx.message.video || ctx.message.document || ctx.message.voice || ctx.message.audio) {
      const mediaCaption = ctx.message.caption ? `\n\n💬 <b>សារ:</b>\n${escapeHtml(ctx.message.caption)}` : '';
      const mediaLabel = ctx.message.photo ? '📷 រូបភាព' : ctx.message.video ? '🎥 វីដេអូ' : ctx.message.voice ? '🎤 សំឡេង' : '📄 ឯកសារ';

      const headerCaption = 
        `📩 <b>សារថ្មីពីអ្នកប្រើប្រាស់</b> (${mediaLabel})\n\n` +
        `👤 <b>ឈ្មោះ:</b> ${userDisplay} (${usernameDisplay})\n` +
        `🆔 <b>លេខសម្គាល់អ្នកប្រើប្រាស់:</b> <code>${user.id}</code>\n` +
        `🎫 <b>លេខសំណើ:</b> <code>#${ticketShortId}</code>` +
        mediaCaption + `\n\n` +
        `<i>💡 សូមចុច Reply លើសារនេះ ដើម្បីឆ្លើយតបទៅកាន់អ្នកប្រើប្រាស់។</i>`;

      let sentMsg;
      if (ctx.message.photo) {
        sentMsg = await ctx.api.sendPhoto(adminChatId, mediaFileId!, {
          caption: headerCaption,
          parse_mode: 'HTML',
          reply_markup: actionKeyboard,
        });
      } else if (ctx.message.video) {
        sentMsg = await ctx.api.sendVideo(adminChatId, mediaFileId!, {
          caption: headerCaption,
          parse_mode: 'HTML',
          reply_markup: actionKeyboard,
        });
      } else if (ctx.message.voice) {
        sentMsg = await ctx.api.sendVoice(adminChatId, mediaFileId!, {
          caption: headerCaption,
          parse_mode: 'HTML',
          reply_markup: actionKeyboard,
        });
      } else if (ctx.message.audio) {
        sentMsg = await ctx.api.sendAudio(adminChatId, mediaFileId!, {
          caption: headerCaption,
          parse_mode: 'HTML',
          reply_markup: actionKeyboard,
        });
      } else {
        sentMsg = await ctx.api.sendDocument(adminChatId, mediaFileId!, {
          caption: headerCaption,
          parse_mode: 'HTML',
          reply_markup: actionKeyboard,
        });
      }
      sentAdminMessageId = sentMsg.message_id;
    }
    // Case C: Sticker or Other
    else {
      const copyMsg = await ctx.api.copyMessage(adminChatId, ctx.chat.id, userMessageId);
      const cardMsg = await ctx.api.sendMessage(
        adminChatId,
        `📩 <b>សារថ្មីពីអ្នកប្រើប្រាស់</b> (Sticker)\n👤 <b>ឈ្មោះ:</b> ${userDisplay} (${usernameDisplay})\n🆔 <b>លេខសម្គាល់អ្នកប្រើប្រាស់:</b> <code>${user.id}</code>\n🎫 <b>លេខសំណើ:</b> <code>#${ticketShortId}</code>`,
        {
          parse_mode: 'HTML',
          reply_markup: actionKeyboard,
          reply_parameters: { message_id: copyMsg.message_id },
        }
      );
      sentAdminMessageId = cardMsg.message_id;
    }

    // 6. Store message record in Supabase
    await RelayService.recordMessage({
      ticket_id: ticketId,
      user_id: user.id,
      sender_type: 'user',
      user_message_id: userMessageId,
      admin_message_id: sentAdminMessageId,
      content_type: contentType,
      text_content: textContent,
      media_file_id: mediaFileId,
    });

    logger.info(`Relayed 1 unified message from user ${user.id} to admin chat (ID: ${sentAdminMessageId})`);
  } catch (err) {
    logger.error(`Failed to forward message from user ${user.id} to admin group:`, err);
    await ctx.reply('⚠️ សូមអភ័យទោស មានបញ្ហាក្នុងការផ្ញើសារទៅកាន់ក្រុមការងារ។ សូមព្យាយាមម្តងទៀត។').catch(() => {});
  }
}
