# Applicant Connect

Create a full-stack Telegram Application & Recruitment management system with an Admin Web Dashboard and webhook-based Telegram Bot.

Key features:
1. Webhook Telegram Bot endpoint to handle user survey flow:
   - Command /start gives a welcome and a button "📝 Подать заявку"
   - Step-by-step stateful questionnaire:
     1. Сколько вам лет?
     2. Имеется ли опыт?
     3. Сколько готовы уделять ворку?
     4. Ваш Discord?
   - On completion, save application to database and send notification to the configured Admin Telegram Group with inline buttons (✅ Одобрить / ❌ Отклонить).
   - When approved or rejected (either via Telegram inline buttons or via the Web Dashboard), update status in DB and send a notification message back to the applicant in Telegram.

2. Admin Web Dashboard:
   - Overview metrics: Total applications, Pending, Approved, Rejected.
   - Applications Table: Filter by status, search by Discord or Telegram username, sorting by date.
   - Application Detail modal / card: shows all answers, candidate info (full name, username, telegram ID, discord), timeline/status.
   - Action buttons in Web Dashboard: "Одобрить" and "Отклонить" with confirmation, which trigger message delivery to the user via Telegram Bot API.
   - Settings page: configure Telegram Bot Token, Admin Group ID, and custom approval/rejection response templates, plus webhook setup guide and instructions.
   - Clean, modern, dark/light theme UI with quick status indicators and responsive layout.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://chat-apply-hq.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/770cbd07-6e9e-47fb-b844-d8cbb458e5b2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
