import { createFileRoute } from "@tanstack/react-router";

import {
  APPLICATION_STATUS_LABEL,
  decideApplication,
  escapeHtml,
  loadSettings,
  notifyAdminGroup,
  sendBannerMessage,
  telegramApi,
  type ApplicationRow,
  type BotSettings,
  type InlineButton,
} from "@/lib/telegram.server";

const MANUALS_BUTTON_TEXT = "📗 Мануалы";
const HELP_BUTTON_TEXT = "❗ Мне нужна помощь";

type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

type TelegramUpdate = {
  update_id?: number;
  message?: {
    chat: { id: number; type: string };
    from?: TelegramUser;
    text?: string;
  };
  callback_query?: {
    id: string;
    data?: string;
    from?: TelegramUser;
    message?: { chat: { id: number }; message_id: number };
  };
};

function fullName(user: TelegramUser | undefined): string | null {
  if (!user) return null;
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return name.length > 0 ? name : null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (table: string) => any };
}

async function sendWelcome(settings: BotSettings, chatId: number, user: TelegramUser | undefined) {
  if (!settings.bot_token) return;

  let statusLabel = "не подана";
  let approved = false;
  if (user) {
    const store = await db();
    const { data: application } = await store
      .from("applications")
      .select("status")
      .eq("telegram_user_id", user.id)
      .maybeSingle();
    if (application) {
      statusLabel = APPLICATION_STATUS_LABEL[application.status] ?? application.status;
      approved = application.status === "approved";
    }
  }

  const caption = [
    `${approved ? "🔓" : "🔒"} <b>Главное меню</b>`,
    "",
    escapeHtml(settings.welcome_message),
    "",
    `👤 <b>${escapeHtml(fullName(user) ?? "Без имени")}</b>`,
    `🔗 ${user?.username ? `@${escapeHtml(user.username)}` : "—"}`,
    `🆔 <code>${user?.id ?? chatId}</code>`,
    `📋 Статус заявки: ${statusLabel}`,
  ].join("\n");

  const reply_markup = approved
    ? {
        keyboard: [[{ text: MANUALS_BUTTON_TEXT }, { text: HELP_BUTTON_TEXT }]],
        resize_keyboard: true,
        is_persistent: true,
      }
    : { inline_keyboard: [[{ text: "📝 Подать заявку", callback_data: "apply" }]] };

  await sendBannerMessage(settings.bot_token, chatId, settings.welcome_image_url, caption, reply_markup);
}

async function sendManuals(settings: BotSettings, chatId: number) {
  if (!settings.bot_token) return;
  const text = [`📚 <b>Мануалы</b>`, "", escapeHtml(settings.manuals_intro)].join("\n");
  const keyboard: InlineButton[][] = settings.manuals.map((manual, index) => [
    manual.url ? { text: manual.title, url: manual.url } : { text: manual.title, callback_data: `manual:${index}` },
  ]);
  keyboard.push([{ text: "◀️ Назад", callback_data: "menu" }]);
  await sendBannerMessage(settings.bot_token, chatId, settings.manuals_banner_url, text, {
    inline_keyboard: keyboard,
  });
}

async function sendManual(settings: BotSettings, chatId: number, index: number) {
  if (!settings.bot_token) return;
  const manual = settings.manuals[index];
  if (!manual) return;
  const text = [`📘 <b>${escapeHtml(manual.title)}</b>`, "", escapeHtml(manual.text ?? "")].join("\n");
  await sendBannerMessage(settings.bot_token, chatId, null, text, {
    inline_keyboard: [[{ text: "◀️ Назад", callback_data: "manuals" }]],
  });
}

async function sendHelp(settings: BotSettings, chatId: number) {
  if (!settings.bot_token) return;
  const text = [`🆘 <b>Помощь</b>`, "", escapeHtml(settings.help_intro)].join("\n");
  const keyboard: InlineButton[][] = settings.moderators.map((moderator) => [
    { text: moderator.label, url: moderator.url },
  ]);
  keyboard.push([{ text: "◀️ Назад", callback_data: "menu" }]);
  await sendBannerMessage(settings.bot_token, chatId, settings.help_banner_url, text, {
    inline_keyboard: keyboard,
  });
}

async function askQuestion(settings: BotSettings, chatId: number, step: number) {
  if (!settings.bot_token) return;
  const question = settings.questions[step];
  if (!question) return;
  await telegramApi(settings.bot_token, "sendMessage", {
    chat_id: chatId,
    text: `${step + 1}/${settings.questions.length} — ${question}`,
  });
}

function pickDiscord(
  answers: { question: string; answer: string }[],
  questions: string[],
): string | null {
  const index = questions.findIndex((question) => /discord|дискорд/i.test(question));
  if (index >= 0 && answers[index]) return answers[index].answer;
  const fallback = answers[answers.length - 1];
  return fallback ? fallback.answer : null;
}

async function handleMessage(settings: BotSettings, update: TelegramUpdate) {
  const message = update.message!;
  if (message.chat.type !== "private") return;
  const chatId = message.chat.id;
  const text = (message.text ?? "").trim();
  const store = await db();

  if (text.startsWith("/start")) {
    await store.from("bot_sessions").upsert({
      chat_id: chatId,
      telegram_user_id: message.from?.id ?? null,
      step: 0,
      answers: [],
      active: false,
    });
    await sendWelcome(settings, chatId, message.from);
    return;
  }

  if (text === MANUALS_BUTTON_TEXT) {
    await sendManuals(settings, chatId);
    return;
  }

  if (text === HELP_BUTTON_TEXT) {
    await sendHelp(settings, chatId);
    return;
  }

  const { data: session } = await store
    .from("bot_sessions")
    .select("*")
    .eq("chat_id", chatId)
    .maybeSingle();

  if (!session || !session.active) {
    await sendWelcome(settings, chatId, message.from);
    return;
  }

  if (text.length === 0) {
    if (settings.bot_token) {
      await telegramApi(settings.bot_token, "sendMessage", {
        chat_id: chatId,
        text: "Пожалуйста, отправьте текстовый ответ.",
      });
    }
    return;
  }

  const question = settings.questions[session.step] ?? `Вопрос ${session.step + 1}`;
  const answers = [
    ...(Array.isArray(session.answers) ? session.answers : []),
    { question, answer: text },
  ];
  const nextStep = session.step + 1;

  if (nextStep < settings.questions.length) {
    await store
      .from("bot_sessions")
      .update({ step: nextStep, answers, active: true })
      .eq("chat_id", chatId);
    await askQuestion(settings, chatId, nextStep);
    return;
  }

  const { data: created, error } = await store
    .from("applications")
    .insert({
      telegram_user_id: message.from?.id ?? chatId,
      telegram_chat_id: chatId,
      telegram_username: message.from?.username ?? null,
      full_name: fullName(message.from),
      discord: pickDiscord(answers, settings.questions),
      answers,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    await store.from("bot_sessions").update({ active: false, step: 0, answers: [] }).eq("chat_id", chatId);
    // Unique violation: this Telegram user already has an application on file.
    // Defends against double-submits (e.g. two near-simultaneous requests)
    // even though we already check for this before starting the survey.
    if (error.code === "23505" && settings.bot_token) {
      await telegramApi(settings.bot_token, "sendMessage", {
        chat_id: chatId,
        text: "⚠️ Вы уже подавали заявку ранее. Повторная подача недоступна.",
      });
      return;
    }
    throw new Error(error.message);
  }

  await store.from("bot_sessions").update({ active: false, step: 0, answers: [] }).eq("chat_id", chatId);

  if (settings.bot_token) {
    await telegramApi(settings.bot_token, "sendMessage", {
      chat_id: chatId,
      text: "✅ Спасибо! Ваша заявка отправлена на рассмотрение. Мы сообщим о решении здесь.",
    });
  }
  await notifyAdminGroup(created as ApplicationRow);
}

async function handleCallback(settings: BotSettings, update: TelegramUpdate) {
  const callback = update.callback_query!;
  const data = callback.data ?? "";
  const answer = async (text?: string) => {
    if (!settings.bot_token) return;
    await telegramApi(settings.bot_token, "answerCallbackQuery", {
      callback_query_id: callback.id,
      ...(text ? { text } : {}),
    });
  };

  if (data === "apply") {
    const chatId = callback.message?.chat.id;
    const userId = callback.from?.id;
    if (!chatId) return;
    if (settings.questions.length === 0) {
      await answer("Анкета пока не настроена.");
      return;
    }
    const store = await db();

    if (userId) {
      const { data: existing } = await store
        .from("applications")
        .select("status, created_at")
        .eq("telegram_user_id", userId)
        .maybeSingle();
      if (existing) {
        await answer("Вы уже подавали заявку.");
        const statusText =
          existing.status === "pending"
            ? "⏳ она ещё на рассмотрении. Дождитесь решения — оно придёт сюда."
            : existing.status === "approved"
              ? "✅ она уже одобрена. Повторная подача недоступна."
              : "❌ она была отклонена. Повторная подача недоступна.";
        if (settings.bot_token) {
          const submittedAt = existing.created_at
            ? new Date(existing.created_at).toLocaleDateString("ru-RU")
            : null;
          await telegramApi(settings.bot_token, "sendMessage", {
            chat_id: chatId,
            text: `Вы уже подавали заявку${submittedAt ? ` ${submittedAt}` : ""}: ${statusText}`,
          });
        }
        return;
      }
    }

    await store.from("bot_sessions").upsert({
      chat_id: chatId,
      telegram_user_id: callback.from?.id ?? null,
      step: 0,
      answers: [],
      active: true,
    });
    await answer("Начинаем!");
    await askQuestion(settings, chatId, 0);
    return;
  }

  if (data === "menu" || data === "manuals" || data === "help") {
    const chatId = callback.message?.chat.id;
    if (!chatId) return;
    await answer();
    if (data === "menu") await sendWelcome(settings, chatId, callback.from);
    else if (data === "manuals") await sendManuals(settings, chatId);
    else await sendHelp(settings, chatId);
    return;
  }

  const manualMatch = /^manual:(\d+)$/.exec(data);
  if (manualMatch) {
    const chatId = callback.message?.chat.id;
    if (!chatId) return;
    await answer();
    await sendManual(settings, chatId, Number(manualMatch[1]));
    return;
  }

  const match = /^(approve|reject):(.+)$/.exec(data);
  if (!match) return;
  const status = match[1] === "approve" ? "approved" : "rejected";
  const label = callback.from?.username ? `@${callback.from.username}` : (fullName(callback.from) ?? "");
  const result = await decideApplication({
    applicationId: match[2]!,
    status,
    via: "telegram",
    decidedLabel: label,
  });
  await answer(
    result.changed
      ? status === "approved"
        ? "Заявка одобрена"
        : "Заявка отклонена"
      : "Решение уже принято",
  );
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let settings: BotSettings;
        try {
          settings = await loadSettings();
        } catch (error) {
          console.error(error);
          return new Response("Settings unavailable", { status: 500 });
        }

        const provided = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (!timingSafeEqual(provided, settings.webhook_secret)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let update: TelegramUpdate;
        try {
          update = (await request.json()) as TelegramUpdate;
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        try {
          if (update.message) await handleMessage(settings, update);
          else if (update.callback_query) await handleCallback(settings, update);
        } catch (error) {
          console.error("Telegram webhook error", error);
        }

        return Response.json({ ok: true });
      },
    },
  },
});
