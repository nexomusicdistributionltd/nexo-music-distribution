import * as React from "react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

export function AuthCard({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-md rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 shadow-[var(--nexo-shadow-sm)] sm:p-8",
        className
      )}
    >
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo height={28} href="/" />
        <h1 className="mt-5 text-h3 text-[var(--nexo-text)]">{title}</h1>
        {description ? (
          <p className="mt-2 text-small text-[var(--nexo-text-muted)]">{description}</p>
        ) : null}
      </div>
      {children}
      {footer ? <div className="mt-6 text-center text-small text-[var(--nexo-text-muted)]">{footer}</div> : null}
    </div>
  );
}
