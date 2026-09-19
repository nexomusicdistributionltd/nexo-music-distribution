"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { ArrowUpRight, ChevronDown, ChevronUp } from "lucide-react";
import { isNavActive, type NavSection } from "@/lib/auth/nav";
import { cn } from "@/lib/utils";

export function PortalAccordionNav({
  sections,
  onNavigate,
}: {
  sections: NavSection[];
  onNavigate?: () => void;
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
    <nav aria-label="Portal" className="flex flex-col">
      {sections.map((section) => (
        <AccordionSection
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

function AccordionSection({
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
  const groups = section.groups?.length ? section.groups : [section.items];
  const flatItems = groups.flat();
  const hasActive = flatItems.some((item) => isNavActive(pathname, item.href));
  const sectionCount = flatItems.reduce((sum, item) => sum + (item.count ?? 0), 0);
  const [open, setOpen] = React.useState(hasActive);

  React.useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive, pathname]);


  return (
    <div className="border-b border-[var(--nexo-border)]">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3.5 text-left text-[0.9375rem] text-[var(--nexo-text-secondary)] hover:bg-[var(--nexo-ghost-hover)] hover:text-[var(--nexo-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-ring)]"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{section.label}</span>
          {sectionCount > 0 ? <CountBadge count={sectionCount} compact /> : null}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        )}
      </button>
      {open ? (
        <div className="px-3 pb-3">
          <div className="overflow-hidden rounded-xl border border-[var(--nexo-border)] bg-[var(--nexo-surface)] text-[var(--nexo-text)]">
            {groups.map((group, gi) => (
              <div
                key={`${section.id}-g-${gi}`}
                className={gi > 0 ? "border-t border-[var(--nexo-border)]" : undefined}
              >
                {group.map((item) => {
                  const active = isNavActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch={false}
                      onPointerEnter={() => onIntent?.(item.href)}
                      onPointerDown={() => onIntent?.(item.href)}
                      onTouchStart={() => onIntent?.(item.href)}
                      onFocus={() => onIntent?.(item.href)}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center justify-between gap-3 px-4 py-2.5 text-[0.875rem] text-[var(--nexo-text-secondary)] hover:bg-[var(--nexo-ghost-hover)] hover:text-[var(--nexo-text)]",
                        active && "bg-[var(--nexo-ghost-hover)] text-[var(--nexo-text)]"
                      )}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate">{item.label}</span>
                        {item.badge === "NEW" ? (
                          <span className="rounded-full bg-[#1f6b3a] px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-white">
                            NEW
                          </span>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {(item.count ?? 0) > 0 ? <CountBadge count={item.count ?? 0} /> : null}
                        {item.external ? (
                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                        ) : null}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}


function CountBadge({ count, compact = false }: { count: number; compact?: boolean }) {
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      aria-label={`${count} item${count === 1 ? "" : "s"} requiring attention`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-red-600 font-semibold leading-none text-white",
        compact ? "min-w-4 px-1 py-0.5 text-[0.58rem]" : "min-w-5 px-1.5 py-1 text-[0.62rem]"
      )}
    >
      {label}
    </span>
  );
}
