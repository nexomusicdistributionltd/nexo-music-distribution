"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin/emails", label: "Inbox", match: "inbox" as const },
  { href: "/admin/contact", label: "Website Messages", match: "exact" as const },
  { href: "/admin/emails/compose", label: "Compose", match: "prefix" as const },
  { href: "/admin/emails/templates", label: "Templates", match: "prefix" as const },
  { href: "/admin/emails/automated", label: "Automated", match: "prefix" as const },
  { href: "/admin/emails/sent", label: "Sent", match: "exact" as const },
  { href: "/admin/emails/failed", label: "Failed", match: "exact" as const },
  { href: "/admin/emails/activity", label: "Activity", match: "exact" as const },
  { href: "/admin/newsletter", label: "Newsletter", match: "exact" as const },
];

export function EmailsSubnav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Communications"
      className="mb-6 flex flex-wrap items-center gap-1 rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] p-1"
    >
      {ITEMS.map((item) => {
        const active =
          item.match === "inbox"
            ? pathname === "/admin/emails" || pathname.startsWith("/admin/emails/inbox")
            : item.match === "exact"
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
