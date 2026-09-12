import * as React from "react";
import { cn } from "@/lib/utils";

const variants = {
  default: "border-[var(--nexo-border)] bg-[var(--nexo-elevated)] text-[var(--nexo-text)]",
  success:
    "border-[var(--nexo-success)]/30 bg-[var(--nexo-success-bg)] text-[var(--nexo-success)]",
  warning:
    "border-[var(--nexo-warning)]/30 bg-[var(--nexo-warning-bg)] text-[var(--nexo-warning)]",
  error:
    "border-[var(--nexo-error)]/30 bg-[var(--nexo-error-bg)] text-[var(--nexo-error)]",
} as const;

export function Alert({
  variant = "default",
  title,
  children,
  className,
}: {
  variant?: keyof typeof variants;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-[var(--nexo-radius)] border px-4 py-3 text-small",
        variants[variant],
        className
      )}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      {children ? <div className={cn(title && "mt-1 opacity-90")}>{children}</div> : null}
    </div>
  );
}
