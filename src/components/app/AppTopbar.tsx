"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Bell, Menu, MessageSquare, Plus, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { AdminSearch } from "@/components/admin/AdminSearch";
import { AppNav } from "@/components/app/AppNav";
import { LogoutButton } from "@/components/app/LogoutButton";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import type { NavSection, WorkspaceKind } from "@/lib/auth/nav";
import { titleForPath } from "@/lib/auth/nav";
import { cn } from "@/lib/utils";

export function AppTopbar({
  sections,
  displayName,
  workspaceKind = "artist",
  logoHref = "/dashboard",
  unreadNotifications = 0,
  unreadMessages = 0,
  showSearch = false,
  notificationsHref,
  messagesHref,
  quickAction,
}: {
  sections: NavSection[];
  displayName: string;
  workspaceKind?: WorkspaceKind;
  logoHref?: string;
  unreadNotifications?: number;
  unreadMessages?: number;
  showSearch?: boolean;
  notificationsHref?: string;
  messagesHref?: string;
  quickAction?: { href: string; label: string } | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const title = titleForPath(pathname, sections);

  React.useEffect(() => setOpen(false), [pathname]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--nexo-border)] bg-[var(--nexo-bg)]/90 px-4 backdrop-blur-sm lg:px-6">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--nexo-radius-sm)] hover:bg-[var(--nexo-ghost-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-ring)] lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-workspace-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="lg:hidden">
          <Logo height={22} href={logoHref} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="hidden text-[0.65rem] font-medium uppercase tracking-[0.14em] text-[var(--nexo-text-muted)] lg:block">
            {workspaceKind === "admin" ? "Operations" : workspaceKind === "label" ? "Label" : "Artist"}
          </p>
          <h1 className="truncate text-h4 leading-tight">{title}</h1>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {showSearch ? (
            <div className="hidden min-w-[16rem] md:block lg:min-w-[20rem]">
              <AdminSearch compact />
            </div>
          ) : null}
          {notificationsHref ? (
            <HeaderIconLink href={notificationsHref} label="Notifications" badge={unreadNotifications}>
              <Bell className="h-4 w-4" />
            </HeaderIconLink>
          ) : null}
          {messagesHref ? (
            <HeaderIconLink href={messagesHref} label="Messages" badge={unreadMessages}>
              <MessageSquare className="h-4 w-4" />
            </HeaderIconLink>
          ) : null}
          {quickAction ? (
            <Link
              href={quickAction.href}
              className="inline-flex h-8 items-center gap-1.5 rounded-[var(--nexo-radius)] bg-[var(--nexo-primary)] px-3 text-[length:0.75rem] font-medium [color:var(--nexo-primary-fg)] hover:bg-[var(--nexo-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-ring)]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{quickAction.label}</span>
            </Link>
          ) : null}
          <span className="hidden max-w-[10rem] truncate text-caption text-[var(--nexo-text-muted)] xl:inline">
            {displayName}
          </span>
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
          <div className="hidden lg:block">
            <LogoutButton variant="button" />
          </div>
          <div className="lg:hidden">
            <LogoutButton variant="icon" />
          </div>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" id="mobile-workspace-nav">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--nexo-overlay)]"
            aria-label="Close menu backdrop"
            onClick={() => setOpen(false)}
          />
          <div
            className="nexo-motion absolute inset-y-0 left-0 flex w-[min(20rem,88vw)] flex-col bg-[var(--nexo-surface)] shadow-[var(--nexo-shadow-lg)]"
            role="dialog"
            aria-modal="true"
            aria-label="Workspace navigation"
          >
            <div className="flex h-14 items-center justify-between border-b border-[var(--nexo-border)] px-4">
              <Logo height={22} href={logoHref} />
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--nexo-radius-sm)] hover:bg-[var(--nexo-ghost-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-ring)]"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-3">
              <AppNav sections={sections} onNavigate={() => setOpen(false)} />
            </div>
            <div className="border-t border-[var(--nexo-border)] p-3">
              <p className="mb-2 truncate px-1 text-caption text-[var(--nexo-text-muted)]">{displayName}</p>
              {showSearch ? (
                <div className="mb-3 px-1">
                  <AdminSearch compact />
                </div>
              ) : null}
              <div className="mb-2 flex items-center justify-between">
                <ThemeToggle />
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function HeaderIconLink({
  href,
  label,
  badge = 0,
  children,
}: {
  href: string;
  label: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={badge > 0 ? `${label} (${badge} unread)` : label}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-[var(--nexo-radius-sm)] text-[var(--nexo-text-secondary)]",
        "hover:bg-[var(--nexo-ghost-hover)] hover:text-[var(--nexo-text)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-ring)]"
      )}
    >
      {children}
      {badge > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[0.58rem] font-bold leading-none text-white shadow-sm">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}
