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
      className={cn(surface && "bg-[var(--nexo-surface)]", className)}
    >
      <div className="pub-container pub-section">{children}</div>
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
  return <p className={cn("pub-kicker", className)}>{children}</p>;
}
