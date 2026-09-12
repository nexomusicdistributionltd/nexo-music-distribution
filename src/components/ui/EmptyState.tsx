import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--nexo-radius-lg)] border border-dashed border-[var(--nexo-border)] bg-[var(--nexo-surface)] px-6 py-12 text-center",
        className
      )}
    >
      <h3 className="text-h4 text-[var(--nexo-text)]">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-small text-[var(--nexo-text-muted)]">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
