"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { LogOut, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import type { NavItem } from "@/lib/auth/nav";
import { cn } from "@/lib/utils";

export function AppTopbar({
  items,
  displayName,
}: {
  items: NavItem[];
  displayName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);

  React.useEffect(() => setOpen(false), [pathname]);

  async function logout() {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      try {
        await supabase.rpc("write_audit_log", {
          p_action: "logout",
          p_entity_type: "user",
          p_entity_id: null,
          p_metadata: {},
        });
      } catch {
        /* audit must not block logout */
      }
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <header className="flex h-14 items-center gap-3 border-b border-[var(--nexo-border)] bg-[var(--nexo-bg)] px-4 lg:hidden">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--nexo-radius-sm)] hover:bg-[var(--nexo-ghost-hover)]"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <Logo height={24} href="/dashboard" />
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden max-w-[10rem] truncate text-caption text-[var(--nexo-text-muted)] sm:inline">
            {displayName}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            disabled={loggingOut}
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="hidden items-center justify-between border-b border-[var(--nexo-border)] px-6 py-3 lg:flex">
        <p className="text-small text-[var(--nexo-text-muted)]">
          Signed in as <span className="text-[var(--nexo-text)]">{displayName}</span>
        </p>
        <Button variant="outline" size="sm" className="rounded-full" onClick={logout} disabled={loggingOut}>
          {loggingOut ? "Signing out…" : "Log out"}
        </Button>
      </div>

      {open ? (
        <div className="border-b border-[var(--nexo-border)] bg-[var(--nexo-surface)] px-3 py-3 lg:hidden">
          <nav className="space-y-1" aria-label="Mobile app">
            {items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/admin" &&
                  item.href !== "/dashboard" &&
                  item.href !== "/support" &&
                  pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block rounded-[var(--nexo-radius-sm)] px-3 py-2 text-small",
                    active
                      ? "bg-[var(--nexo-elevated)] font-medium"
                      : "text-[var(--nexo-text-secondary)]"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}
    </>
  );
}
