"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import {
  Bell,
  BookOpen,
  ClipboardCheck,
  Disc3,
  FileSearch,
  Globe,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Newspaper,
  Plus,
  Scale,
  ScrollText,
  Settings,
  Shield,
  User,
  Users,
  Wallet,
} from "lucide-react";
import type { NavIconId, NavSection } from "@/lib/auth/nav";
import { isNavActive } from "@/lib/auth/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<NavIconId, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  catalog: Disc3,
  release: Plus,
  distribution: Globe,
  roster: Users,
  qc: ClipboardCheck,
  ddex: FileSearch,
  publishing: BookOpen,
  finance: Wallet,
  analytics: ScrollText,
  messages: MessageSquare,
  notifications: Bell,
  newsletter: Newspaper,
  website: Globe,
  users: Users,
  audit: ScrollText,
  settings: Settings,
  profile: User,
  support: Mail,
  search: FileSearch,
  compliance: Scale,
  email: Mail,
};

function Icon({ id, className }: { id?: NavIconId; className?: string }) {
  if (!id) return null;
  const Cmp = ICONS[id] ?? Shield;
  return <Cmp className={className} aria-hidden />;
}

export function AppNav({
  sections,
  onNavigate,
  id = "app-nav",
}: {
  sections: NavSection[];
  onNavigate?: () => void;
  id?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const prefetchOnIntent = React.useCallback(
    (href: string) => {
      if (href.startsWith("/")) router.prefetch(href);
    },
    [router]
  );

  return (
    <nav id={id} className="space-y-4" aria-label="Workspace">
      {sections.map((section) => (
        <NavGroup
          key={section.id}
          section={section}
          pathname={pathname}
          onNavigate={onNavigate}
          onIntent={prefetchOnIntent}
        />
      ))}
    </nav>
  );
}

function NavGroup({
  section,
  pathname,
  onNavigate,
  onIntent,
}: {
  section: NavSection;
  pathname: string;
  onNavigate?: () => void;
  onIntent?: (href: string) => void;
}) {
  const hasActive = section.items.some((item) => isNavActive(pathname, item.href));
  const collapsible = Boolean(section.collapsible && section.items.length > 1);
  const [open, setOpen] = React.useState(hasActive || !collapsible);

  React.useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive, pathname]);

  if (section.items.length === 1 && !collapsible) {
    const item = section.items[0];
    return (
      <div>
        <p className="mb-1 px-3 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-[var(--nexo-text-muted)]">
          {section.label}
        </p>
        <NavLink
          item={item}
          pathname={pathname}
          onNavigate={onNavigate}
          onIntent={onIntent}
        />
      </div>
    );
  }

  return (
    <div>
      {collapsible ? (
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-1 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-[var(--nexo-text-muted)] transition-colors hover:text-[var(--nexo-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-ring)]"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{section.label}</span>
          <span className="text-[0.7rem]" aria-hidden>
            {open ? "–" : "+"}
          </span>
        </button>
      ) : (
        <p className="mb-1 px-3 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-[var(--nexo-text-muted)]">
          {section.label}
        </p>
      )}
      {open || !collapsible ? (
        <div className="mt-0.5 space-y-0.5" role="group" aria-label={section.label}>
          {section.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
              onIntent={onIntent}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NavLink({
  item,
  pathname,
  onNavigate,
  onIntent,
}: {
  item: NavSection["items"][number];
  pathname: string;
  onNavigate?: () => void;
  onIntent?: (href: string) => void;
}) {
  const active = isNavActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      prefetch={false}
      onPointerEnter={() => onIntent?.(item.href)}
      onFocus={() => onIntent?.(item.href)}
      onClick={onNavigate}
      className={cn(
        "nexo-motion group flex items-center gap-2.5 rounded-[var(--nexo-radius-sm)] px-3 py-1.5 text-[0.8125rem] transition-colors duration-[var(--nexo-duration)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-ring)]",
        active
          ? "bg-[var(--nexo-elevated)] font-medium text-[var(--nexo-text)]"
          : "text-[var(--nexo-text-secondary)] hover:bg-[var(--nexo-ghost-hover)] hover:text-[var(--nexo-text)]"
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon id={item.icon} className="h-3.5 w-3.5 shrink-0 opacity-80" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
