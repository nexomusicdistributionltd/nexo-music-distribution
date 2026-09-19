"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Bell, Building2, Menu, MessageSquare, X, CirclePlus, Link2 } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { LogoutButton } from "@/components/app/LogoutButton";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { PortalAccordionNav } from "@/components/portal/PortalAccordionNav";
import type { NavItem, NavSection, WorkspaceKind } from "@/lib/auth/nav";
import { titleForPath } from "@/lib/auth/nav";
import { cn } from "@/lib/utils";
import { IdentityVerifiedBadge } from "@/components/identity/IdentityVerifiedBadge";

export function PortalChrome({
  sections,
  accountItems,
  displayName,
  workspaceKind,
  unreadNotifications = 0,
  unreadMessages = 0,
  labelName,
  identityVerified = false,
}: {
  sections: NavSection[];
  accountItems: NavItem[];
  displayName: string;
  workspaceKind: Exclude<WorkspaceKind, "admin">;
  unreadNotifications?: number;
  unreadMessages?: number;
  labelName?: string | null;
  identityVerified?: boolean;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = React.useState(false);
  const [accountOpen, setAccountOpen] = React.useState(false);
  const title = titleForPath(pathname, [
    ...sections,
    { id: "account-overlay", label: "Account", items: accountItems },
  ]);

  React.useEffect(() => {
    setNavOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    const any = navOpen || accountOpen;
    if (!any) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNavOpen(false);
        setAccountOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [navOpen, accountOpen]);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[18.5rem] flex-col border-r border-[var(--nexo-border)] bg-[var(--nexo-bg)] text-[var(--nexo-text)] lg:flex">
        <div className="flex h-14 items-center border-b border-[var(--nexo-border)] px-4">
          <Logo height={22} href="/dashboard" />
        </div>
        <div className="flex-1 overflow-y-auto pb-8">
          <PortalAccordionNav sections={sections} />
        </div>
      </aside>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--nexo-border)] bg-[var(--nexo-bg)]/90 px-4 backdrop-blur-sm lg:ml-[18.5rem] lg:px-6">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--nexo-radius-sm)] hover:bg-[var(--nexo-ghost-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-ring)] lg:hidden"
          aria-label={navOpen ? "Close menu" : "Open menu"}
          aria-expanded={navOpen}
          onClick={() => {
            setAccountOpen(false);
            setNavOpen((v) => !v);
          }}
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="lg:hidden">
          <Logo height={22} href="/dashboard" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="hidden text-[0.65rem] font-medium uppercase tracking-[0.14em] text-[var(--nexo-text-muted)] sm:block">
            {workspaceKind === "label" ? "Label" : "Artist"}
          </p>
          <h1 className="truncate text-h4 leading-tight">{title}</h1>
        </div>
        <Link href="/dashboard/releases/new" className="hidden h-9 items-center gap-2 rounded-full bg-[var(--nexo-text)] px-4 text-[0.72rem] font-semibold [color:var(--nexo-text-inverse)] hover:opacity-90 md:inline-flex">
          <CirclePlus className="h-4 w-4" /> New release
        </Link>
        <Link href="/dashboard/fanlinks" aria-label="Fanlinks" className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--nexo-radius-sm)] text-[var(--nexo-text-secondary)] hover:bg-[var(--nexo-ghost-hover)]">
          <Link2 className="h-4 w-4" />
        </Link>
        <Link
          href="/dashboard/notifications"
          aria-label={unreadNotifications ? `Notifications (${unreadNotifications} unread)` : "Notifications"}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-[var(--nexo-radius-sm)] text-[var(--nexo-text-secondary)] hover:bg-[var(--nexo-ghost-hover)]"
        >
          <Bell className="h-4 w-4" />
          {unreadNotifications > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[0.58rem] font-bold leading-none text-white shadow-sm">
              {unreadNotifications > 99 ? "99+" : unreadNotifications}
            </span>
          ) : null}
        </Link>
        <Link
          href="/support"
          aria-label={unreadMessages ? `Messages (${unreadMessages} active)` : "Messages"}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-[var(--nexo-radius-sm)] text-[var(--nexo-text-secondary)] hover:bg-[var(--nexo-ghost-hover)]"
        >
          <MessageSquare className="h-4 w-4" />
          {unreadMessages > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[0.58rem] font-bold leading-none text-white shadow-sm">
              {unreadMessages > 99 ? "99+" : unreadMessages}
            </span>
          ) : null}
        </Link>
        <button
          type="button"
          className="hidden max-w-[12rem] truncate text-caption text-[var(--nexo-text-muted)] hover:text-[var(--nexo-text)] sm:inline"
          onClick={() => {
            setNavOpen(false);
            setAccountOpen(true);
          }}
        >
          <span className="inline-flex items-center gap-1.5">{displayName}{identityVerified ? <IdentityVerifiedBadge compact /> : null}</span>
        </button>
        <ThemeToggle />
        <button
          type="button"
          className="inline-flex h-8 max-w-[9rem] items-center truncate rounded-full border border-[var(--nexo-border)] px-3 text-[0.7rem] font-medium uppercase tracking-wide hover:bg-[var(--nexo-ghost-hover)]"
          aria-label="Open account menu"
          onClick={() => {
            setNavOpen(false);
            setAccountOpen(true);
          }}
        >
          Account
        </button>
      </header>

      {navOpen ? (
        <FullOverlay onClose={() => setNavOpen(false)} labelledBy="portal-nav-title">
          <div className="flex h-14 items-center justify-end px-4">
            <CloseX onClick={() => setNavOpen(false)} />
          </div>
          <h2 id="portal-nav-title" className="sr-only">
            NEXO MUSIC DISTRIBUTION LTD menu
          </h2>
          <div className="flex-1 overflow-y-auto pb-10">
            <PortalAccordionNav sections={sections} onNavigate={() => setNavOpen(false)} />
          </div>
        </FullOverlay>
      ) : null}

      {accountOpen ? (
        <FullOverlay onClose={() => setAccountOpen(false)} labelledBy="portal-account-title">
          <div className="flex items-start justify-between gap-4 px-5 pt-6">
            <div className="min-w-0">
              <Logo height={28} href="/dashboard" />
              <p className="mt-4 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--nexo-text)]">
                NEXO MUSIC DISTRIBUTION LTD
              </p>
              <h2
                id="portal-account-title"
                className="mt-3 truncate text-[0.95rem] font-semibold uppercase tracking-[0.08em] text-[var(--nexo-text)]"
              >
                <span className="inline-flex items-center gap-2">{displayName}{identityVerified ? <IdentityVerifiedBadge compact /> : null}</span>
              </h2>
            </div>
            <CloseX onClick={() => setAccountOpen(false)} />
          </div>
          <div className="mt-6 flex-1 overflow-y-auto px-4">
            <div className="overflow-hidden rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-surface)] text-[var(--nexo-text)]">
              {accountItems.map((it, idx) => {
                const isLabels = it.href === "/account/labels";
                return (
                  <React.Fragment key={it.href}>
                    {isLabels ? <div className="border-t border-white/10" /> : null}
                    <Link
                      href={it.href}
                      onClick={() => setAccountOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 text-[0.9rem] text-[var(--nexo-text-secondary)] hover:bg-[var(--nexo-ghost-hover)]",
                        idx > 0 && !isLabels ? "" : ""
                      )}
                    >
                      {isLabels && labelName ? (
                        <>
                          <Building2 className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                          <span className="min-w-0">
                            <span className="block truncate">{labelName}</span>
                            <span className="block text-[0.7rem] text-[var(--nexo-text-muted)]">Labels</span>
                          </span>
                        </>
                      ) : (
                        <span>{it.label}</span>
                      )}
                    </Link>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
          <div className="p-4">
            <LogoutButton
              variant="button"
              label="Logout"
              className="h-11 w-full border border-[var(--nexo-border)] bg-transparent [color:#e07070] hover:bg-[var(--nexo-ghost-hover)]"
            />
          </div>
        </FullOverlay>
      ) : null}
    </>
  );
}

function FullOverlay({
  children,
  onClose,
  labelledBy,
}: {
  children: React.ReactNode;
  onClose: () => void;
  labelledBy: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--nexo-bg)] text-[var(--nexo-text)]" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <button type="button" className="sr-only" onClick={onClose}>
        Close
      </button>
      {children}
    </div>
  );
}

function CloseX({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close"
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--nexo-text-secondary)] hover:bg-[var(--nexo-ghost-hover)] hover:text-[var(--nexo-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-ring)]"
      onClick={onClick}
    >
      <X className="h-5 w-5" />
    </button>
  );
}
