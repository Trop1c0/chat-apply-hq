# Telegram Recruitment Manager

A Telegram bot that collects applications through a step-by-step chat survey, plus a private admin dashboard for reviewing, approving and rejecting candidates.

## How it will work

1. A candidate opens the bot and sends `/start`. The bot replies with a welcome message and a button "📝 Подать заявку".
2. The bot then asks the configured questions one at a time (default: age, experience, hours available, Discord), remembering where each person is in the flow.
3. When finished, the application is saved and posted to your admin Telegram group with "✅ Одобрить" / "❌ Отклонить" buttons.
4. Approving or rejecting — from the group buttons or from the dashboard — updates the application and sends your custom message to the candidate.

## Admin dashboard (login required)

- **Sign in** with email and password. Only signed-in admins can see anything.
- **Overview**: total, pending, approved and rejected counts.
- **Applications table**: filter by status, search by Discord or Telegram username, sort by date.
- **Detail view**: all answers, candidate name, username, Telegram ID, Discord, plus a status timeline showing who decided and when.
- **Approve / Reject** buttons with a confirmation step; the candidate is messaged immediately.
- **Settings**: bot token, admin group ID, editable survey questions (add, remove, reorder, reword), welcome text, and approval/rejection message templates. Includes a copy-ready webhook URL and step-by-step setup guide.
- Dark and light theme, responsive layout, clear colour-coded status badges.

## Design direction

Dark-first control-room look: deep slate surfaces, a single vivid accent for primary actions, amber/emerald/rose status tones, compact data-dense tables, and a distinctive geometric sans for headings paired with a clean text face. No purple-gradient template look.

## Technical notes

- Lovable Cloud enabled for database, admin authentication and server-side logic.
- Tables: `applications` (candidate info, answers JSON, status, decided_by, decided_at), `bot_sessions` (per-chat survey state), `bot_settings` (token, group id, questions, templates), `user_roles` + `has_role()` for admin checks. RLS: only authenticated admins read/write; the webhook writes through a service-role path.
- Bot token is saved server-side only and never exposed to the browser; the dashboard shows a masked value.
- Webhook: public route `POST /api/public/telegram/webhook`, protected by a secret token registered with Telegram via `setWebhook`. Handles `message` and `callback_query` updates idempotently.
- Approvals from the dashboard go through authenticated server functions that call the Telegram Bot API.
- Settings page shows the stable webhook URL to paste into BotFather/`setWebhook`, and I will register it automatically once a token is saved.

## Notes

- You will need your BotFather bot token and the numeric ID of the admin group (the bot must be a member with permission to post).
- Any message templates or welcome copy I write initially are placeholders — review them in Settings.
