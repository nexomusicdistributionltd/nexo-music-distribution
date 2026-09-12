import { cn } from "@/lib/utils";

const styles = {
  live: "bg-[var(--nexo-success-bg)] text-[var(--nexo-success)] border-[var(--nexo-success)]/30",
  processing:
    "bg-[var(--nexo-warning-bg)] text-[var(--nexo-warning)] border-[var(--nexo-warning)]/30",
  approved:
    "bg-[var(--nexo-info-bg)] text-[var(--nexo-info)] border-[var(--nexo-border-strong)]",
  rejected:
    "bg-[var(--nexo-error-bg)] text-[var(--nexo-error)] border-[var(--nexo-error)]/30",
  draft:
    "bg-[var(--nexo-elevated)] text-[var(--nexo-text-muted)] border-[var(--nexo-border)]",
  pending:
    "bg-[var(--nexo-warning-bg)] text-[var(--nexo-warning)] border-[var(--nexo-warning)]/30",
} as const;

export type StatusKind = keyof typeof styles;

export function StatusBadge({
  status,
  className,
  label,
}: {
  status: StatusKind;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-caption font-medium capitalize",
        styles[status],
        className
      )}
    >
      {label ?? status}
    </span>
  );
}
