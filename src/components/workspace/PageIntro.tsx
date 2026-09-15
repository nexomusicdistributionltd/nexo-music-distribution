import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-[var(--nexo-text-muted)]">
            {eyebrow}
          </p>
        ) : null}
        {title ? <h2 className="text-h3 tracking-tight">{title}</h2> : null}
        {description ? (
          <p className="mt-1 max-w-2xl text-small text-[var(--nexo-text-muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
