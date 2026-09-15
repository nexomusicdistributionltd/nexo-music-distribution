import * as React from "react";
import { Alert } from "./Alert";
import { cn } from "@/lib/utils";

export function ErrorState({
  title = "Something went wrong",
  description,
  retryHref,
  retryLabel = "Retry",
  className,
}: {
  title?: string;
  description?: string;
  retryHref?: string;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <Alert variant="error" title={title} className={cn(className)}>
      <div className="space-y-3">
        <p>{description ?? "Please try again. If the problem continues, contact support."}</p>
        {retryHref ? (
          <a
            href={retryHref}
            className="inline-flex h-8 items-center rounded-[var(--nexo-radius-sm)] border border-[var(--nexo-error)]/40 px-3 text-caption font-medium"
          >
            {retryLabel}
          </a>
        ) : null}
      </div>
    </Alert>
  );
}
