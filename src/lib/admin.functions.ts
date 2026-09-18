import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROJECT_ID = "770cbd07-6e9e-47fb-b844-d8cbb458e5b2";

export const WEBHOOK_URLS = {
  production: `https://project--${PROJECT_ID}.lovable.app/api/public/telegram/webhook`,
  preview: `https://project--${PROJECT_ID}-dev.lovable.app/api/public/telegram/webhook`,
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin access required");
}

export type AdminSettings = {
  hasToken: boolean;
  tokenHint: string | null;
  adminGroupId: string;
  welcomeMessage: string;
  welcomeImageUrl: string;
  questions: string[];
  approveTemplate: string;
  rejectTemplate: string;
  webhookUrls: typeof WEBHOOK_URLS;
};

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminSettings> => {
    await assertAdmin(context as any);
    const { loadSettings } = await import("./telegram.server");
    const settings = await loadSettings();
    const token = settings.bot_token ?? "";
    return {
      hasToken: token.length > 0,
      tokenHint: token.length > 0 ? `${token.slice(0, 6)}…${token.slice(-4)}` : null,
      adminGroupId: settings.admin_group_id ?? "",
      welcomeMessage: settings.welcome_message,
      welcomeImageUrl: settings.welcome_image_url ?? "",
      questions: settings.questions,
      approveTemplate: settings.approve_template,
      rejectTemplate: settings.reject_template,
      webhookUrls: WEBHOOK_URLS,
    };
  });

const settingsSchema = z.object({
  botToken: z.string().trim().optional(),
  adminGroupId: z.string().trim().max(64),
  welcomeMessage: z.string().trim().min(1).max(2000),
  welcomeImageUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value.length === 0 || /^https?:\/\//.test(value), "Введите корректную ссылку")
    .optional(),
  questions: z.array(z.string().trim().min(1).max(300)).min(1).max(15),
  approveTemplate: z.string().trim().min(1).max(2000),
  rejectTemplate: z.string().trim().min(1).max(2000),
});

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {
      admin_group_id: data.adminGroupId || null,
      welcome_message: data.welcomeMessage,
      welcome_image_url: data.welcomeImageUrl || null,
      questions: data.questions,
      approve_template: data.approveTemplate,
      reject_template: data.rejectTemplate,
    };
    if (data.botToken && data.botToken.length > 0) patch["bot_token"] = data.botToken;
    const { error } = await (supabaseAdmin as any)
      .from("bot_settings")
      .update(patch)
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const registerWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ target: z.enum(["production", "preview"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { loadSettings, telegramApi } = await import("./telegram.server");
    const settings = await loadSettings();
    if (!settings.bot_token) throw new Error("Сначала сохраните токен бота.");
    await telegramApi(settings.bot_token, "setWebhook", {
      url: WEBHOOK_URLS[data.target],
      secret_token: settings.webhook_secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    });
    const info = await telegramApi<{ url?: string; pending_update_count?: number }>(
      settings.bot_token,
      "getWebhookInfo",
      {},
    );
    return { url: info.url ?? WEBHOOK_URLS[data.target] };
  });

export const decide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        applicationId: z.string().uuid(),
        status: z.enum(["approved", "rejected"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    const { decideApplication } = await import("./telegram.server");
    const email = (context as any).claims?.email as string | undefined;
    const result = await decideApplication({
      applicationId: data.applicationId,
      status: data.status,
      via: "dashboard",
      decidedBy: (context as any).userId,
      decidedLabel: email ?? "дашборд",
    });
    if (!result.application) throw new Error("Заявка не найдена.");
    return { changed: result.changed, status: result.application.status };
  });
