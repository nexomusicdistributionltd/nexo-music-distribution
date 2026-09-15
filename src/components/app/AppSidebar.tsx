"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LogoutButton } from "@/components/app/LogoutButton";
import { AppNav } from "@/components/app/AppNav";
import type { NavSection, WorkspaceKind } from "@/lib/auth/nav";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<WorkspaceKind, string> = {
  admin: "Operations",
  label: "Label",
  artist: "Artist",
};

export function AppSidebar({
  sections,
  accountLabel,
  displayName,
  workspaceKind = "artist",
  logoHref = "/dashboard",
  className,
}: {
  sections: NavSection[];
  accountLabel?: string;
  displayName?: string;
  workspaceKind?: WorkspaceKind;
  logoHref?: string;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "flex h-full w-[16.5rem] shrink-0 flex-col border-r border-[var(--nexo-border)] bg-[var(--nexo-surface)]",
        className
      )}
    >
      <div className="flex h-14 items-center border-b border-[var(--nexo-border)] px-4">
        <Logo height={24} href={logoHref} />
      </div>
      <div className="border-b border-[var(--nexo-border)] px-4 py-3">
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-[var(--nexo-text-muted)]">
          {KIND_LABEL[workspaceKind]}
        </p>
        <p className="mt-0.5 truncate text-small font-medium text-[var(--nexo-text)]">
          {displayName || accountLabel || "Account"}
        </p>
        {accountLabel ? (
          <p className="truncate text-caption text-[var(--nexo-text-muted)]">{accountLabel}</p>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <AppNav sections={sections} />
      </div>
      <div className="border-t border-[var(--nexo-border)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <Link
            href="/"
            className="text-caption text-[var(--nexo-text-muted)] underline-offset-4 hover:text-[var(--nexo-text)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-ring)]"
          >
            Public site
          </Link>
          <ThemeToggle />
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
