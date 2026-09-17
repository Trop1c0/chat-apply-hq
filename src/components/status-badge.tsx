import { Check, Clock, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type AppStatus = "pending" | "approved" | "rejected";

export const STATUS_LABELS: Record<AppStatus, string> = {
  pending: "На рассмотрении",
  approved: "Одобрено",
  rejected: "Отклонено",
};

// Monochrome status system: pending is a neutral outline, approved is a
// solid filled badge (highest emphasis, no color needed to read as
// "positive"), and rejected is the one place that keeps a muted accent
// color, since it's an irreversible outcome worth flagging at a glance.
const STATUS_STYLES: Record<AppStatus, string> = {
  pending: "border-border bg-muted text-muted-foreground",
  approved: "border-transparent bg-foreground text-background",
  rejected: "border-destructive/25 bg-destructive/10 text-destructive",
};

const STATUS_ICONS: Record<AppStatus, typeof Check> = {
  pending: Clock,
  approved: Check,
  rejected: X,
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const key = (["pending", "approved", "rejected"] as AppStatus[]).includes(status as AppStatus)
    ? (status as AppStatus)
    : "pending";
  const Icon = STATUS_ICONS[key];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_STYLES[key],
        className,
      )}
    >
      <Icon className="size-3" strokeWidth={2.5} />
      {STATUS_LABELS[key]}
    </span>
  );
}
