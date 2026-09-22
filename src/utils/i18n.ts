import { InlineKeyboard } from 'grammy';

export interface Translation {
  welcome: string;
  selectLanguage: string;
  helpPrompt: string;
  agentConnected: (name: string) => string;
  ticketClosed: string;
  ratingPrompt: string;
  ratingThanks: string;
  feedbackOptionsPrompt: string;
  feedbackThanks: string;
}

export const translations: Record<string, Translation> = {
  km: {
    welcome: 'សួស្តី! សូមស្វាគមន៍មកកាន់សេវាបម្រើអតិថិជន <b>NSSF SOC Support</b>\nHi! Welcome to NSSF SOC Support',
    selectLanguage: 'សូមជ្រើសរើសភាសា / Please select a language:',
    helpPrompt: 'សូមផ្ញើសំណួរ បញ្ហា ឬឯកសាររបស់អ្នកនៅទីនេះ ក្រុមការងាររបស់យើងនឹងឆ្លើយតបជូនលោកអ្នកក្នុងពេលឆាប់ៗ។',
    agentConnected: (name: string) => `👨‍💼 ភ្នាក់ងារផ្ទាល់ <b>${name}</b> ត្រូវបានភ្ជាប់។`,
    ticketClosed: '✅ ការសន្ទនារបស់លោកអ្នកត្រូវបានបញ្ចប់។ សូមអរគុណដែលបានទាក់ទងមកយើងខ្ញុំ!',
    ratingPrompt: 'សូមវាយតម្លៃកម្រិតនៃការពេញចិត្តចំពោះសេវាកម្មរបស់យើងខ្ញុំ៖',
    ratingThanks: 'សូមអរគុណសម្រាប់ការវាយតម្លៃរបស់លោកអ្នក! 🙏',
    feedbackOptionsPrompt: 'សូមមេត្តាផ្តល់មតិយោបល់អំពីចំណុចដែលលោកអ្នកពេញចិត្ត៖',
    feedbackThanks: 'សូមអរគុណច្រើនចំពោះការផ្តល់មតិកែលម្អ! សូមជូនពរលោកអ្នកមានសុខភាពល្អ។',
  },
  en: {
    welcome: 'Hi! Welcome to <b>NSSF SOC Customer Support</b>.',
    selectLanguage: 'Please select your preferred language:',
    helpPrompt: 'Please send your questions, issues, or documents here. Our support team will assist you shortly.',
    agentConnected: (name: string) => `👨‍💼 Live agent <b>${name}</b> is now connected.`,
    ticketClosed: '✅ Your support session has been closed. Thank you for contacting us!',
    ratingPrompt: 'Please rate your satisfaction with our support service:',
    ratingThanks: 'Thank you for your rating! 🙏',
    feedbackOptionsPrompt: 'Please let us know what you liked most about our service:',
    feedbackThanks: 'Thank you very much for your feedback! Have a wonderful day.',
  },
};

export function getLanguageKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🇰🇭 ខ្មែរ', 'lang_km')
    .row()
    .text('🇬🇧 English', 'lang_en');
}

export function getRatingKeyboard(ticketId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('⭐⭐⭐⭐⭐ (5/5)', `rate_${ticketId}_5`)
    .row()
    .text('⭐⭐⭐⭐ (4/5)', `rate_${ticketId}_4`)
    .row()
    .text('⭐⭐⭐ (3/5)', `rate_${ticketId}_3`)
    .row()
    .text('⭐⭐ (2/5)', `rate_${ticketId}_2`)
    .row()
    .text('⭐ (1/5)', `rate_${ticketId}_1`);
}

export function getFeedbackCategoriesKeyboard(ticketId: string, lang = 'km'): InlineKeyboard {
  if (lang === 'km') {
    return new InlineKeyboard()
      .text('ងាយស្រួលក្នុងការទំនាក់ទំនង', `fb_${ticketId}_easy`)
      .row()
      .text('ការឆ្លើយតបរហ័ស និងទាន់ពេលវេលា', `fb_${ticketId}_fast`)
      .row()
      .text('ភ្នាក់ងារមានជំនាញដោះស្រាយបញ្ហា', `fb_${ticketId}_skilled`)
      .row()
      .text('ការផ្តល់ព័ត៌មានមានភាពច្បាស់លាស់', `fb_${ticketId}_clear`)
      .row()
      .text('ភ្នាក់ងារផ្តល់ដំណោះស្រាយបានត្រឹមត្រូវ', `fb_${ticketId}_accurate`);
  }

  return new InlineKeyboard()
    .text('Easy to communicate', `fb_${ticketId}_easy`)
    .row()
    .text('Fast & timely response', `fb_${ticketId}_fast`)
    .row()
    .text('Skilled & helpful agent', `fb_${ticketId}_skilled`)
    .row()
    .text('Clear & accurate information', `fb_${ticketId}_clear`)
    .row()
    .text('Problem fully resolved', `fb_${ticketId}_accurate`);
}
