import Link from "next/link";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";

export function QueryPagination({
  page,
  pageCount,
  hrefForPage,
  className,
}: {
  page: number;
  pageCount: number;
  hrefForPage: (page: number) => string;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav
      className={cn("flex items-center justify-between gap-3 pt-3 text-small", className)}
      aria-label="Pagination"
    >
      {page > 1 ? (
        <Link
          href={hrefForPage(page - 1)}
          className="rounded-[var(--nexo-radius-sm)] border border-[var(--nexo-border)] px-3 py-1.5 hover:bg-[var(--nexo-ghost-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-ring)]"
        >
          Previous
        </Link>
      ) : (
        <span className="px-3 py-1.5 text-[var(--nexo-text-muted)]">Previous</span>
      )}
      <span className="text-[var(--nexo-text-muted)]">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link
          href={hrefForPage(page + 1)}
          className="rounded-[var(--nexo-radius-sm)] border border-[var(--nexo-border)] px-3 py-1.5 hover:bg-[var(--nexo-ghost-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-ring)]"
        >
          Next
        </Link>
      ) : (
        <span className="px-3 py-1.5 text-[var(--nexo-text-muted)]">Next</span>
      )}
    </nav>
  );
}

export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]" role="status" aria-label="Loading">
      <div className="grid gap-0">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-6 gap-3 border-b border-[var(--nexo-divider)] px-4 py-3 last:border-0"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cols }).map((__, j) => (
              <Skeleton key={j} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function buildQueryHref(
  pathname: string,
  current: Record<string, string | number | undefined>,
  patch: Record<string, string | number | undefined>
) {
  const params = new URLSearchParams();
  const merged = { ...current, ...patch };
  for (const [k, v] of Object.entries(merged)) {
    if (v === undefined || v === "" || v === "all") continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
