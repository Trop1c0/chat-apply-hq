import { cn } from "@/lib/utils";

export type AppStatus = "pending" | "approved" | "rejected";

export const STATUS_LABELS: Record<AppStatus, string> = {
  pending: "На рассмотрении",
  approved: "Одобрено",
  rejected: "Отклонено",
};

const STATUS_STYLES: Record<AppStatus, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  approved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const key = (["pending", "approved", "rejected"] as AppStatus[]).includes(status as AppStatus)
    ? (status as AppStatus)
    : "pending";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_STYLES[key],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABELS[key]}
    </span>
  );
}
