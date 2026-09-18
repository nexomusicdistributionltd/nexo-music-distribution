"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  return (
    <nav aria-label="Portal" className="flex flex-col">
      {sections.map((section) => (
        <AccordionSection
          key={section.id}
          section={section}
          pathname={pathname}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

function AccordionSection({
  section,
  pathname,
  onNavigate,
}: {
  section: NavSection;
  pathname: string;
  onNavigate?: () => void;
}) {
  const groups = section.groups?.length ? section.groups : [section.items];
  const hasActive = groups.flat().some((item) => isNavActive(pathname, item.href));
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
        <span>{section.label}</span>
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
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center justify-between gap-3 px-4 py-2.5 text-[0.875rem] text-[var(--nexo-text-secondary)] hover:bg-[var(--nexo-ghost-hover)] hover:text-[var(--nexo-text)]",
                        active && "bg-[var(--nexo-ghost-hover)] text-[var(--nexo-text)]"
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{item.label}</span>
                        {item.badge === "NEW" ? (
                          <span className="rounded-full bg-[#1f6b3a] px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-white">
                            NEW
                          </span>
                        ) : null}
                      </span>
                      {item.external ? (
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                      ) : null}
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
