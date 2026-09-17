import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getSettings, registerWebhook, saveSettings } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Настройки бота — RecruitOps" },
      { name: "description", content: "Токен бота, группа админов, вопросы анкеты и шаблоны ответов." },
      { property: "og:title", content: "Настройки бота — RecruitOps" },
      {
        property: "og:description",
        content: "Токен бота, группа админов, вопросы анкеты и шаблоны ответов.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

function SettingsPage() {
  const queryClient = useQueryClient();
  const getSettingsFn = useServerFn(getSettings);
  const saveSettingsFn = useServerFn(saveSettings);
  const registerWebhookFn = useServerFn(registerWebhook);

  const { data, isLoading } = useQuery({
    queryKey: ["bot-settings"],
    queryFn: () => getSettingsFn(),
  });

  const [botToken, setBotToken] = useState("");
  const [adminGroupId, setAdminGroupId] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [approveTemplate, setApproveTemplate] = useState("");
  const [rejectTemplate, setRejectTemplate] = useState("");

  useEffect(() => {
    if (!data) return;
    setAdminGroupId(data.adminGroupId);
    setWelcomeMessage(data.welcomeMessage);
    setQuestions(data.questions);
    setApproveTemplate(data.approveTemplate);
    setRejectTemplate(data.rejectTemplate);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      saveSettingsFn({
        data: {
          botToken: botToken.trim(),
          adminGroupId,
          welcomeMessage,
          questions: questions.map((question) => question.trim()).filter((q) => q.length > 0),
          approveTemplate,
          rejectTemplate,
        },
      }),
    onSuccess: () => {
      setBotToken("");
      toast.success("Настройки сохранены.");
      queryClient.invalidateQueries({ queryKey: ["bot-settings"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить настройки"),
  });

  const register = useMutation({
    mutationFn: (target: "production" | "preview") => registerWebhookFn({ data: { target } }),
    onSuccess: (result) => toast.success(`Webhook подключён: ${result.url}`),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось подключить webhook"),
  });

  if (isLoading || !data) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Подключение бота, вопросы анкеты и текст ответов кандидатам.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Section
            title="Telegram-бот"
            description="Токен хранится на сервере и никогда не показывается полностью."
          >
            <div className="space-y-1.5">
              <Label htmlFor="token">Токен бота</Label>
              <Input
                id="token"
                type="password"
                placeholder={data.hasToken ? `Сохранён: ${data.tokenHint}` : "123456:ABC-DEF…"}
                value={botToken}
                onChange={(event) => setBotToken(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Получите токен у @BotFather. Оставьте поле пустым, чтобы не менять текущий.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group">ID группы администраторов</Label>
              <Input
                id="group"
                placeholder="-1001234567890"
                value={adminGroupId}
                onChange={(event) => setAdminGroupId(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Добавьте бота в группу, отправьте там любое сообщение и укажите её ID (начинается с
                -100).
              </p>
            </div>
          </Section>

          <Section title="Приветствие" description="Первое сообщение после команды /start.">
            <Textarea
              rows={4}
              value={welcomeMessage}
              onChange={(event) => setWelcomeMessage(event.target.value)}
            />
          </Section>

          <Section
            title="Вопросы анкеты"
            description="Бот задаёт их по порядку. От 1 до 15 вопросов."
          >
            {questions.map((question, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={question}
                  onChange={(event) =>
                    setQuestions(questions.map((q, i) => (i === index ? event.target.value : q)))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={questions.length <= 1}
                  onClick={() => setQuestions(questions.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={questions.length >= 15}
              onClick={() => setQuestions([...questions, ""])}
            >
              <Plus className="size-4" /> Добавить вопрос
            </Button>
          </Section>
        </div>

        <div className="space-y-4">
          <Section
            title="Ответы кандидату"
            description="Доступные подстановки: {name}, {username}, {discord}."
          >
            <div className="space-y-1.5">
              <Label>Одобрение</Label>
              <Textarea
                rows={4}
                value={approveTemplate}
                onChange={(event) => setApproveTemplate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Отказ</Label>
              <Textarea
                rows={4}
                value={rejectTemplate}
                onChange={(event) => setRejectTemplate(event.target.value)}
              />
            </div>
          </Section>

          <Section
            title="Подключение webhook"
            description="Telegram будет присылать сообщения на этот адрес."
          >
            <CopyRow label="Основной адрес (публикация)" value={data.webhookUrls.production} />
            <CopyRow label="Тестовый адрес (preview)" value={data.webhookUrls.preview} />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={register.isPending || !data.hasToken}
                onClick={() => register.mutate("production")}
              >
                Подключить основной
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={register.isPending || !data.hasToken}
                onClick={() => register.mutate("preview")}
              >
                Подключить тестовый
              </Button>
            </div>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Создайте бота в @BotFather и скопируйте токен.</li>
              <li>Вставьте токен выше и сохраните настройки.</li>
              <li>Добавьте бота в группу админов и укажите её ID.</li>
              <li>Нажмите «Подключить основной» после публикации приложения.</li>
              <li>Напишите боту /start и пройдите анкету для проверки.</li>
            </ol>
          </Section>
        </div>
      </div>

      <div className="sticky bottom-4 mt-6 flex justify-end">
        <Button size="lg" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Сохранение…" : "Сохранить настройки"}
        </Button>
      </div>
    </AppShell>
  );
}
