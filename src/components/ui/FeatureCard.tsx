import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";

type FeatureCardProps = {
  icon?: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  className?: string;
};

export function FeatureCard({
  icon,
  title,
  description,
  badge,
  className,
}: FeatureCardProps) {
  return (
    <article
      className={cn(
        "group relative rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 transition-colors duration-[var(--nexo-duration)] hover:border-[var(--nexo-border-strong)] hover:bg-[var(--nexo-elevated)]",
        className
      )}
    >
      {badge ? (
        <Badge className="absolute right-4 top-4 border-[var(--nexo-border-strong)]">
          {badge}
        </Badge>
      ) : null}
      {icon ? (
        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] text-[var(--nexo-text)]">
          {icon}
        </div>
      ) : null}
      <h3 className="text-h4 text-[var(--nexo-text)]">{title}</h3>
      <p className="mt-2 text-small text-[var(--nexo-text-muted)]">{description}</p>
    </article>
  );
}
