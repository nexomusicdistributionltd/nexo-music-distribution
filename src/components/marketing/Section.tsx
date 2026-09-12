import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  id,
  className,
  children,
  surface = false,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
  surface?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        surface && "border-y border-[var(--nexo-border)] bg-[var(--nexo-surface)]",
        className
      )}
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        {children}
      </div>
    </section>
  );
}

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-caption font-medium uppercase tracking-[0.16em] text-[var(--nexo-text-muted)]",
        className
      )}
    >
      {children}
    </p>
  );
}
