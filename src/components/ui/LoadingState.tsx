import { cn } from "@/lib/utils";

export function LoadingState({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 py-10 text-small text-[var(--nexo-text-muted)]",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--nexo-border-strong)] border-t-[var(--nexo-text)]" />
      {label}
    </div>
  );
}
