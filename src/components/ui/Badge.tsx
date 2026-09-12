import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] px-2 py-0.5 text-caption text-[var(--nexo-text-secondary)]",
        className
      )}
    >
      {children}
    </span>
  );
}
