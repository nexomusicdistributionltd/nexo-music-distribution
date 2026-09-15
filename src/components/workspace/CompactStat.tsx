import Link from "next/link";
import { cn } from "@/lib/utils";

export function CompactStat({
  label,
  value,
  href,
  hint,
  tone = "default",
}: {
  label: string;
  value: number | string;
  href?: string;
  hint?: string;
  tone?: "default" | "urgent" | "warning";
}) {
  const inner = (
    <div
      className={cn(
        "rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] px-4 py-3",
        tone === "urgent" && "border-[var(--nexo-error)]/30",
        tone === "warning" && "border-[var(--nexo-warning)]/30"
      )}
    >
      <p className="text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="mt-0.5 text-caption text-[var(--nexo-text-muted)]">{hint}</p> : null}
    </div>
  );
  if (!href) return inner;
  return (
    <Link href={href} className="block transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-ring)]">
      {inner}
    </Link>
  );
}

export function AttentionList({
  items,
}: {
  items: Array<{ id: string; href: string; title: string; meta: string; tone?: string }>;
}) {
  return (
    <ul className="divide-y divide-[var(--nexo-divider)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className="flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-[var(--nexo-ghost-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--nexo-ring)]"
          >
            <span className="text-small font-medium">{item.title}</span>
            <span className="text-caption text-[var(--nexo-text-muted)]">{item.meta}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
