import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ArrowDownWideNarrow, ArrowUpWideNarrow, Inbox, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { StatusBadge, STATUS_LABELS } from "@/components/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { decide } from "@/lib/admin.functions";

type Application = {
  id: string;
  telegram_user_id: number;
  telegram_chat_id: number;
  telegram_username: string | null;
  full_name: string | null;
  discord: string | null;
  answers: { question: string; answer: string }[];
  status: string;
  created_at: string;
  decided_at: string | null;
  decided_via: string | null;
};

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Заявки — RecruitOps" },
      { name: "description", content: "Панель управления заявками кандидатов из Telegram." },
      { property: "og:title", content: "Заявки — RecruitOps" },
      { property: "og:description", content: "Панель управления заявками кандидатов из Telegram." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

const FILTERS = ["all", "pending", "approved", "rejected"] as const;
const FILTER_LABELS: Record<(typeof FILTERS)[number], string> = {
  all: "Все",
  pending: STATUS_LABELS.pending,
  approved: STATUS_LABELS.approved,
  rejected: STATUS_LABELS.rejected,
};

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "primary" | "warning" | "success" | "destructive";
}) {
  const toneClass =
    tone === "warning"
      ? "text-warning"
      : tone === "success"
        ? "text-success"
        : tone === "destructive"
          ? "text-destructive"
          : "text-primary";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={`mt-2 font-display text-3xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Dashboard() {
  const queryClient = useQueryClient();
  const decideFn = useServerFn(decide);
  const [statusFilter, setStatusFilter] = useState<(typeof FILTERS)[number]>("all");
  const [search, setSearch] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [selected, setSelected] = useState<Application | null>(null);
  const [confirm, setConfirm] = useState<{ app: Application; status: "approved" | "rejected" } | null>(
    null,
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as Application[];
    },
    refetchInterval: 20_000,
  });

  const mutation = useMutation({
    mutationFn: (input: { applicationId: string; status: "approved" | "rejected" }) =>
      decideFn({ data: input }),
    onSuccess: (result) => {
      toast.success(
        result.changed
          ? result.status === "approved"
            ? "Заявка одобрена, кандидату отправлено сообщение."
            : "Заявка отклонена, кандидату отправлено сообщение."
          : "Решение по этой заявке уже принято.",
      );
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось обновить заявку"),
  });

  const applications = data ?? [];

  const metrics = useMemo(
    () => ({
      total: applications.length,
      pending: applications.filter((app) => app.status === "pending").length,
      approved: applications.filter((app) => app.status === "approved").length,
      rejected: applications.filter((app) => app.status === "rejected").length,
    }),
    [applications],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return applications
      .filter((app) => statusFilter === "all" || app.status === statusFilter)
      .filter((app) => {
        if (term.length === 0) return true;
        return [app.discord, app.telegram_username, app.full_name]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(term));
      })
      .sort((a, b) => {
        const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return sortDesc ? -diff : diff;
      });
  }, [applications, statusFilter, search, sortDesc]);

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Заявки</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Кандидаты из Telegram-бота и решения по ним.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Всего" value={metrics.total} />
        <MetricCard label={STATUS_LABELS.pending} value={metrics.pending} tone="warning" />
        <MetricCard label={STATUS_LABELS.approved} value={metrics.approved} tone="success" />
        <MetricCard label={STATUS_LABELS.rejected} value={metrics.rejected} tone="destructive" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
          {FILTERS.map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={statusFilter === filter ? "secondary" : "ghost"}
              onClick={() => setStatusFilter(filter)}
            >
              {FILTER_LABELS[filter]}
            </Button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск по Discord или Telegram"
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setSortDesc(!sortDesc)}>
          {sortDesc ? (
            <ArrowDownWideNarrow className="size-4" />
          ) : (
            <ArrowUpWideNarrow className="size-4" />
          )}
          {sortDesc ? "Сначала новые" : "Сначала старые"}
        </Button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="p-6 text-sm text-destructive">
            Не удалось загрузить заявки. Убедитесь, что у аккаунта есть права администратора.
          </p>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center">
            <Inbox className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Заявок пока нет.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium">Кандидат</th>
                  <th className="px-4 py-3 font-medium">Discord</th>
                  <th className="px-4 py-3 font-medium">Дата</th>
                  <th className="px-4 py-3 font-medium">Статус</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {visible.map((app) => (
                  <tr key={app.id} className="border-t border-border/70 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <button
                        className="text-left font-medium hover:text-primary"
                        onClick={() => setSelected(app)}
                      >
                        {app.full_name ?? "Без имени"}
                      </button>
                      <p className="text-xs text-muted-foreground">
                        {app.telegram_username ? `@${app.telegram_username}` : `ID ${app.telegram_user_id}`}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{app.discord ?? "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {format(new Date(app.created_at), "dd.MM.yyyy HH:mm")}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelected(app)}>
                        Открыть
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-3">
                  {selected.full_name ?? "Без имени"}
                  <StatusBadge status={selected.status} />
                </DialogTitle>
              </DialogHeader>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Telegram</dt>
                  <dd>{selected.telegram_username ? `@${selected.telegram_username}` : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Telegram ID</dt>
                  <dd className="font-mono text-xs">{selected.telegram_user_id}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Discord</dt>
                  <dd>{selected.discord ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Подана</dt>
                  <dd>{format(new Date(selected.created_at), "dd.MM.yyyy HH:mm")}</dd>
                </div>
              </dl>

              <div className="mt-2 space-y-3">
                <h3 className="text-sm font-semibold">Ответы</h3>
                {selected.answers.map((entry, index) => (
                  <div key={index} className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">{entry.question}</p>
                    <p className="mt-1 text-sm">{entry.answer}</p>
                  </div>
                ))}
              </div>

              <div className="mt-2 rounded-lg border border-border p-3 text-xs text-muted-foreground">
                <p>Создана: {format(new Date(selected.created_at), "dd.MM.yyyy HH:mm")}</p>
                {selected.decided_at ? (
                  <p className="mt-1">
                    Решение: {STATUS_LABELS[selected.status as "approved" | "rejected"] ?? selected.status}{" "}
                    · {format(new Date(selected.decided_at), "dd.MM.yyyy HH:mm")}
                    {selected.decided_via === "telegram" ? " · из Telegram" : " · из панели"}
                  </p>
                ) : (
                  <p className="mt-1">Ожидает решения.</p>
                )}
              </div>

              {selected.status === "pending" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    className="flex-1"
                    disabled={mutation.isPending}
                    onClick={() => setConfirm({ app: selected, status: "approved" })}
                  >
                    Одобрить
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    disabled={mutation.isPending}
                    onClick={() => setConfirm({ app: selected, status: "rejected" })}
                  >
                    Отклонить
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.status === "approved" ? "Одобрить заявку?" : "Отклонить заявку?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Кандидату будет отправлено сообщение в Telegram, а статус заявки изменится. Отменить
              это действие нельзя.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirm) return;
                mutation.mutate({ applicationId: confirm.app.id, status: confirm.status });
                setConfirm(null);
              }}
            >
              Подтвердить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
