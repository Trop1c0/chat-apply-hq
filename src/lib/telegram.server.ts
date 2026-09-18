// Server-only Telegram Bot API helpers and application decision logic.

export type Manual = {
  title: string;
  text?: string;
  url?: string;
};

export type Moderator = {
  label: string;
  url: string;
};

export type BotSettings = {
  bot_token: string | null;
  admin_group_id: string | null;
  webhook_secret: string;
  welcome_message: string;
  welcome_image_url: string | null;
  questions: string[];
  approve_template: string;
  reject_template: string;
  manuals_banner_url: string | null;
  manuals_intro: string;
  manuals: Manual[];
  help_banner_url: string | null;
  help_intro: string;
  moderators: Moderator[];
};

export type ApplicationRow = {
  id: string;
  telegram_user_id: number;
  telegram_chat_id: number;
  telegram_username: string | null;
  full_name: string | null;
  discord: string | null;
  answers: { question: string; answer: string }[];
  status: string;
  admin_message_id: number | null;
  created_at?: string;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as {
    from: (table: string) => any;
  };
}

export async function loadSettings(): Promise<BotSettings> {
  const db = await admin();
  const { data, error } = await db.from("bot_settings").select("*").eq("id", true).single();
  if (error) throw new Error(`Failed to load bot settings: ${error.message}`);
  const questions = Array.isArray(data.questions) ? (data.questions as string[]) : [];
  const manuals = Array.isArray(data.manuals) ? (data.manuals as Manual[]) : [];
  const moderators = Array.isArray(data.moderators) ? (data.moderators as Moderator[]) : [];
  return { ...data, questions, manuals, moderators } as BotSettings;
}

export async function telegramApi<T = any>(
  token: string,
  method: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
    result?: T;
  };
  if (!response.ok || body.ok === false) {
    const detail = body.description ?? `HTTP ${response.status}`;
    console.error(`Telegram ${method} failed: ${detail}`);
    throw new Error(`Telegram ${method} failed: ${detail}`);
  }
  return body.result as T;
}

export type InlineButton = { text: string; callback_data?: string; url?: string };

/**
 * Sends a photo-banner message with a text fallback (used for every
 * bot "screen": welcome, manuals list, a single manual, help).
 */
export async function sendBannerMessage(
  botToken: string,
  chatId: number,
  bannerUrl: string | null,
  text: string,
  keyboard?: InlineButton[][],
): Promise<void> {
  const reply_markup = keyboard ? { inline_keyboard: keyboard } : undefined;
  if (bannerUrl) {
    try {
      await telegramApi(botToken, "sendPhoto", {
        chat_id: chatId,
        photo: bannerUrl,
        caption: text,
        parse_mode: "HTML",
        reply_markup,
      });
      return;
    } catch (error) {
      console.error("sendPhoto failed, falling back to text message", error);
    }
  }
  await telegramApi(botToken, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup,
  });
}

const KEYCAPS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
function numberEmoji(index: number): string {
  return KEYCAPS[index] ?? `${index + 1}.`;
}

const STATUS_LINE: Record<string, string> = {
  pending: "⏳ <b>На рассмотрении</b>",
  approved: "✅ <b>Одобрено</b>",
  rejected: "❌ <b>Отклонено</b>",
};

export const APPLICATION_STATUS_LABEL: Record<string, string> = {
  pending: "⏳ на рассмотрении",
  approved: "✅ одобрена",
  rejected: "❌ отклонена",
};

const DIVIDER = "────────────────────";

export function describeApplication(
  app: ApplicationRow,
  options?: { status?: string; decidedLabel?: string },
): string {
  const status = options?.status ?? app.status;
  const name = app.full_name ?? "Без имени";
  const username = app.telegram_username ? `@${app.telegram_username}` : "—";
  const submittedAt = app.created_at
    ? new Date(app.created_at).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const answers = app.answers
    .map(
      (entry, index) =>
        `${numberEmoji(index)} <b>${escapeHtml(entry.question)}</b>\n     ${escapeHtml(entry.answer)}`,
    )
    .join("\n\n");

  const statusLine = options?.decidedLabel
    ? `${STATUS_LINE[status] ?? escapeHtml(status)} · ${escapeHtml(options.decidedLabel)}`
    : (STATUS_LINE[status] ?? escapeHtml(status));

  return [
    "🆕 <b>Заявка на вступление</b>",
    DIVIDER,
    `👤 <b>${escapeHtml(name)}</b>`,
    `🔗 ${escapeHtml(username)}`,
    `🆔 <code>${app.telegram_user_id}</code>`,
    app.discord ? `💬 Discord: ${escapeHtml(app.discord)}` : null,
    submittedAt ? `🕐 Подана: ${submittedAt}` : null,
    DIVIDER,
    "📋 <b>Анкета</b>",
    "",
    answers,
    DIVIDER,
    `Статус: ${statusLine}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function fillTemplate(template: string, app: ApplicationRow): string {
  return template
    .replaceAll("{name}", app.full_name ?? "")
    .replaceAll("{username}", app.telegram_username ? `@${app.telegram_username}` : "")
    .replaceAll("{discord}", app.discord ?? "");
}

/**
 * Applies an approve/reject decision: updates the row, messages the applicant,
 * and refreshes the admin group message. Safe to call from the webhook or the
 * dashboard; returns false when the application was already decided.
 */
export async function decideApplication(options: {
  applicationId: string;
  status: "approved" | "rejected";
  via: "telegram" | "dashboard";
  decidedBy?: string | null;
  decidedLabel?: string;
}): Promise<{ changed: boolean; application: ApplicationRow | null }> {
  const db = await admin();
  const { data: existing, error: readError } = await db
    .from("applications")
    .select("*")
    .eq("id", options.applicationId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!existing) return { changed: false, application: null };
  const app = existing as ApplicationRow;
  if (app.status !== "pending") return { changed: false, application: app };

  const { error: updateError } = await db
    .from("applications")
    .update({
      status: options.status,
      decided_at: new Date().toISOString(),
      decided_by: options.decidedBy ?? null,
      decided_via: options.via,
    })
    .eq("id", app.id)
    .eq("status", "pending");
  if (updateError) throw new Error(updateError.message);

  const settings = await loadSettings();
  if (settings.bot_token) {
    const template =
      options.status === "approved" ? settings.approve_template : settings.reject_template;
    try {
      await telegramApi(settings.bot_token, "sendMessage", {
        chat_id: app.telegram_chat_id,
        text: fillTemplate(template, app),
      });
    } catch (error) {
      console.error("Could not notify applicant", error);
    }

    if (settings.admin_group_id && app.admin_message_id) {
      try {
        await telegramApi(settings.bot_token, "editMessageText", {
          chat_id: settings.admin_group_id,
          message_id: app.admin_message_id,
          text: describeApplication(app, {
            status: options.status,
            decidedLabel: options.decidedLabel,
          }),
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [] },
        });
      } catch (error) {
        console.error("Could not update the admin group message", error);
      }
    }
  }

  return { changed: true, application: { ...app, status: options.status } };
}

export async function notifyAdminGroup(app: ApplicationRow): Promise<void> {
  const settings = await loadSettings();
  if (!settings.bot_token || !settings.admin_group_id) return;
  const keyboard: { text: string; callback_data?: string; url?: string }[][] = [
    [
      { text: "✅ Одобрить", callback_data: `approve:${app.id}` },
      { text: "❌ Отклонить", callback_data: `reject:${app.id}` },
    ],
  ];
  if (app.telegram_username) {
    keyboard.push([{ text: "🔗 Открыть профиль", url: `https://t.me/${app.telegram_username}` }]);
  }
  const result = await telegramApi<{ message_id: number }>(settings.bot_token, "sendMessage", {
    chat_id: settings.admin_group_id,
    text: describeApplication(app),
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: keyboard },
  });
  const db = await admin();
  await db.from("applications").update({ admin_message_id: result.message_id }).eq("id", app.id);
}
