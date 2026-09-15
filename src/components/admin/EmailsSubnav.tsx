"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin/emails", label: "Outbox", match: "exact" as const },
  { href: "/admin/emails/templates", label: "Templates", match: "prefix" as const },
  { href: "/admin/emails/send", label: "Send", match: "exact" as const },
];

export function EmailsSubnav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Email admin"
      className="mb-6 inline-flex h-10 items-center gap-1 rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] p-1"
    >
      {ITEMS.map((item) => {
        const active =
          item.match === "exact"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex h-8 items-center rounded-[var(--nexo-radius-sm)] px-3 text-nav transition-colors",
              active
                ? "bg-[var(--nexo-surface)] text-[var(--nexo-text)] shadow-[var(--nexo-shadow-sm)]"
                : "text-[var(--nexo-text-muted)] hover:text-[var(--nexo-text)]"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
