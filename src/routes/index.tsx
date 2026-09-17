import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, MessageSquare, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RecruitOps — набор через Telegram" },
      {
        name: "description",
        content:
          "Приём заявок в Telegram и админ-панель для одобрения кандидатов: анкета в боте, уведомления в группу, решения в один клик.",
      },
      { property: "og:title", content: "RecruitOps — набор через Telegram" },
      {
        property: "og:description",
        content: "Анкета в Telegram-боте, заявки в базе, решения в один клик из админ-панели.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-16">
        <span className="w-fit rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Telegram · Набор в команду
        </span>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
          Заявки из Telegram, решения — в одном месте
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Кандидат проходит короткую анкету в боте, заявка сразу уходит в вашу админ-группу с
          кнопками «Одобрить» и «Отклонить». Панель управления показывает статистику, историю и все
          ответы.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/dashboard">Открыть панель</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">Войти</Link>
          </Button>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            { icon: MessageSquare, title: "Анкета в боте", text: "Пошаговые вопросы, настраиваемые из панели." },
            { icon: CheckCircle2, title: "Решение в один клик", text: "Из Telegram-группы или из панели." },
            { icon: ShieldCheck, title: "Только для админов", text: "Данные закрыты за входом по паролю." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5">
              <Icon className="size-5 text-primary" />
              <h2 className="mt-3 text-base font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
