import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

export function Breadcrumb({
  items,
  className,
}: {
  items: Crumb[];
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1 text-small", className)}>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1">
            {i > 0 ? <ChevronRight className="h-3.5 w-3.5 text-[var(--nexo-text-muted)]" /> : null}
            {item.href && !last ? (
              <Link
                href={item.href}
                className="text-[var(--nexo-text-muted)] hover:text-[var(--nexo-text)]"
              >
                {item.label}
              </Link>
            ) : (
              <span className={last ? "text-[var(--nexo-text)]" : "text-[var(--nexo-text-muted)]"}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
