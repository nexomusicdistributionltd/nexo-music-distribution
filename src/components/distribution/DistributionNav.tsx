import Link from "next/link";

const LINKS: Array<{ href: string; label: string }> = [
  { href: "/admin/distribution", label: "Overview" },
  { href: "/admin/distribution/provider", label: "Provider" },
  { href: "/admin/distribution/queue", label: "Queue" },
  { href: "/admin/distribution/submissions", label: "Submissions" },
  { href: "/admin/distribution/delivery", label: "Delivery" },
  { href: "/admin/distribution/webhooks", label: "Webhooks" },
  { href: "/admin/distribution/failed", label: "Failed" },
  { href: "/admin/distribution/takedowns", label: "Takedowns" },
  { href: "/admin/distribution/migration", label: "Migration" },
  { href: "/admin/distribution/history", label: "History" },
  { href: "/admin/distribution/mapping", label: "Artist mapping" },
  { href: "/admin/distribution/search", label: "Search" },
];

export function DistributionNav({ current }: { current?: string }) {
  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {LINKS.map((l) => {
        const active = current === l.href || (current == null && l.href === "/admin/distribution");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={
              active
                ? "rounded-full bg-[var(--nexo-accent)] px-3 py-1 text-caption font-medium text-black"
                : "rounded-full border border-[var(--nexo-border)] px-3 py-1 text-caption text-[var(--nexo-text-muted)] hover:text-[var(--nexo-text)]"
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
