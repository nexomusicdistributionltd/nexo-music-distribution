"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { hardRedirectToLogin, performClientLogout } from "@/lib/auth/logout-client";
import type { NavItem } from "@/lib/auth/nav";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/admin" || href === "/dashboard" || href === "/support") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({
  items,
  accountLabel,
  logoHref = "/dashboard",
}: {
  items: NavItem[];
  accountLabel?: string;
  logoHref?: string;
}) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = React.useState(false);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await performClientLogout();
      hardRedirectToLogin();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
      <div className="flex h-16 items-center border-b border-[var(--nexo-border)] px-4">
        <Logo height={26} href={logoHref} />
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="App">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-[var(--nexo-radius-sm)] px-3 py-2 text-small transition-colors",
                active
                  ? "bg-[var(--nexo-elevated)] font-medium text-[var(--nexo-text)]"
                  : "text-[var(--nexo-text-secondary)] hover:bg-[var(--nexo-ghost-hover)] hover:text-[var(--nexo-text)]"
              )}
              aria-current={active ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[var(--nexo-border)] p-3">
        {accountLabel ? (
          <p className="mb-2 truncate px-1 text-caption text-[var(--nexo-text-muted)]">
            {accountLabel}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/"
            className="text-caption text-[var(--nexo-text-muted)] underline-offset-4 hover:text-[var(--nexo-text)] hover:underline"
          >
            Public site
          </Link>
          <ThemeToggle />
        </div>
        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--nexo-radius-sm)] px-3 py-2 text-small text-[var(--nexo-text-secondary)] hover:bg-[var(--nexo-ghost-hover)] hover:text-[var(--nexo-text)]"
          onClick={logout}
          disabled={loggingOut}
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
          {loggingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
