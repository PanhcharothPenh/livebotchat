# 🚀 Telegram Live Chat Support Bot (Supabase + Vercel)

A full-featured, real-time **Customer Support Live Chat Bot for Telegram**, backed by **Supabase (PostgreSQL)** and optimized for **Vercel Serverless Functions**.

---

## ✨ Features

- 🔄 **Two-Way Live Relay**: Relays messages (text, photos, voice notes, audio, video, documents, stickers, locations) from users to your Admin/Support group and vice versa.
- 🎯 **Native Telegram Reply**: Support agents simply swipe/click "Reply" to any message in the Telegram group to message the customer back seamlessly.
- 🗄️ **Supabase Integration**: Persistent storage for user profiles, ticket statuses, and message mappings.
- ⚡ **Vercel Serverless Ready**: Uses Telegram Webhooks for fast, cost-effective, zero-server hosting.
- 💻 **Local Development Mode**: Supports instant long-polling for local testing (`npm run dev`).
- 🛡️ **Moderation & Control**: Ban/unban spammers, view user history, broadcast messages, and close tickets.

---

## 📋 Admin Commands

| Command | Description | Example |
|---|---|---|
| *(Reply to user message)* | Relays your message directly to that user | Just swipe & reply |
| `/close` | Closes the active ticket/session for the replied user | Reply `/close` or `/close 12345678` |
| `/info` | Displays user details, message count, and status | Reply `/info` or `/info 12345678` |
| `/ban <user_id>` | Bans a user from contacting support | `/ban 12345678` or reply `/ban` |
| `/unban <user_id>` | Unbans a user | `/unban 12345678` |
| `/stats` | Shows aggregate metrics (total users, open tickets, messages) | `/stats` |
| `/broadcast <text>` | Sends an announcement to all active users | `/broadcast Welcome to our new release!` |
| `/help` | Shows available admin commands | `/help` |

---

## 🛠️ Step 1: Set Up Supabase Database

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard) and open your project.
2. Navigate to **SQL Editor** on the left menu.
3. Open the file [`supabase/schema.sql`](supabase/schema.sql), copy all its contents, paste them into the Supabase SQL Editor, and click **Run**.
4. Go to **Project Settings** -> **API**:
   - Copy **Project URL** (This is your `SUPABASE_URL`).
   - Under **Project API keys**, copy the `service_role` secret key (This is your `SUPABASE_SERVICE_ROLE_KEY`).

---

## 🤖 Step 2: Create Telegram Bot & Support Group

### 1. Create your Bot:
- Open Telegram and message [@BotFather](https://t.me/BotFather).
- Send `/newbot`, name your bot, and get your **Bot Token** (e.g. `1234567890:ABCdefGHIjkl...`).
- *(Optional)* In @BotFather, send `/setprivacy` -> Select your bot -> Choose **Disable** (this allows the bot in your support group to see message replies without needing admin mentions).

### 2. Create Support Group & Get `ADMIN_CHAT_ID`:
- Create a new Telegram Group for your support team.
- Add your bot to the group and make it an **Administrator**.
- To find the Group ID:
  - Add [@RawDataBot](https://t.me/RawDataBot) or [@userinfobot](https://t.me/userinfobot) to the group, and note down the `chat.id` (usually starts with `-100`, e.g., `-1001928374650`).
  - Remove the helper bot after getting your ID.
  - *Tip: If you want to handle support as a solo admin in a private chat, your `ADMIN_CHAT_ID` is your personal Telegram User ID (e.g. `987654321`).*

---

## 💻 Step 3: Local Testing (Optional)

1. Create a `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```
2. Fill in `.env` with your credentials:
   ```env
   TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ
   ADMIN_CHAT_ID=-1001234567890
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   ```
3. Run the bot locally:
   ```bash
   npm run dev
   ```
4. Open Telegram, send `/start` to your bot, and test sending a message!

---

## 🌐 Step 4: Deploy to Vercel

### 1. Push code to GitHub:
```bash
git init
git add .
git commit -m "Initial commit of Telegram Live Chat Bot"
git branch -M main
# Add your remote and push:
# git remote add origin https://github.com/yourusername/telegram-live-chat.git
# git push -u origin main
```

### 2. Import project in Vercel:
1. Go to [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New...** -> **Project**.
2. Select your GitHub repository.
3. In the **Environment Variables** section, add:
   - `TELEGRAM_BOT_TOKEN`
   - `ADMIN_CHAT_ID`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `WEBHOOK_SECRET` *(Optional, e.g. a random alphanumeric string like `my_secret_token_123`)*
4. Click **Deploy**.

### 3. Register the Telegram Webhook:
Once Vercel finishes deploying, you will get your Vercel URL (e.g. `https://telegram-live-chat.vercel.app`).

Simply open this URL in your web browser:
```text
https://YOUR-APP.vercel.app/api/set-webhook
```

You will see:
```json
{
  "success": true,
  "message": "Webhook successfully configured for https://YOUR-APP.vercel.app/api/webhook"
}
```

Alternatively, you can run from your local terminal:
```bash
npm run set-webhook https://YOUR-APP.vercel.app
```

---

## 🔍 Verification & Health Check

- **Check Webhook Status**:
  Visit `https://YOUR-APP.vercel.app/api/set-webhook?action=info`
- **Delete Webhook** (to switch back to local polling):
  Visit `https://YOUR-APP.vercel.app/api/set-webhook?action=delete`

---

## 📁 Project Structure

```text
Bot-Live-Chat/
├── .env.example              # Environment variables template
├── vercel.json               # Vercel serverless routing configuration
├── supabase/
│   └── schema.sql            # PostgreSQL schema ready for Supabase SQL Editor
├── api/
│   ├── webhook.ts            # Vercel Serverless Webhook endpoint
│   └── set-webhook.ts        # One-click browser helper to configure Telegram Webhook
├── src/
│   ├── config.ts             # Environment validator
│   ├── supabase.ts           # Supabase client singleton & types
│   ├── bot.ts                # Grammy Bot initialization
│   ├── local.ts              # Local polling runner for testing
│   ├── handlers/
│   │   ├── userHandler.ts    # User messages -> Relay to Support Group & Supabase
│   │   ├── adminHandler.ts   # Admin replies in Group -> Relay to User & Supabase
│   │   └── commandHandler.ts # /start, /help, /close, /ban, /unban, /info, /stats, /broadcast
│   ├── services/
│   │   ├── userService.ts    # User records, ban management, stats
│   │   ├── ticketService.ts  # Ticket sessions lifecycle
│   │   └── relayService.ts   # Message mapping & routing
│   └── utils/
│       └── logger.ts         # Logger utility
└── scripts/
    └── set-webhook.ts        # CLI tool to register webhook
```
