import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[var(--nexo-radius-sm)] bg-[var(--nexo-elevated)]",
        className
      )}
      aria-hidden
    />
  );
}
