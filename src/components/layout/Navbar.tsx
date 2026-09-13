"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Menu, ArrowRight, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LanguageSelector } from "@/components/layout/LanguageSelector";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { NAV_LINKS } from "@/lib/site";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-[var(--nexo-duration-slow)]",
          scrolled || open
            ? "border-b border-[var(--nexo-nav-border)] bg-[var(--nexo-nav-bg)] backdrop-blur-xl"
            : "border-b border-transparent bg-transparent"
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Logo height={32} priority />

          <nav
            className="ml-2 hidden items-center gap-0.5 xl:flex"
            aria-label="Primary"
          >
            {NAV_LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "relative rounded-[var(--nexo-radius-sm)] px-2.5 py-1.5 text-nav transition-colors",
                    active
                      ? "text-[var(--nexo-nav-link-active)]"
                      : "text-[var(--nexo-nav-link)] hover:text-[var(--nexo-nav-link-hover)]"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {link.label}
                    {"badge" in link && link.badge ? (
                      <Badge className="px-1.5 py-0 text-[0.65rem] leading-4">
                        {link.badge}
                      </Badge>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      "absolute inset-x-2.5 -bottom-0.5 h-px bg-[var(--nexo-nav-link-active)] transition-opacity",
                      active ? "opacity-100" : "opacity-0"
                    )}
                    aria-hidden
                  />
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <LanguageSelector className="hidden sm:inline-flex" />
            <ThemeToggle />
            <Link href="/login" className="hidden sm:inline-flex">
              <Button variant="outline" size="sm" className="rounded-full px-4">
                Log In
              </Button>
            </Link>
            <Link href="/register" className="hidden sm:inline-flex">
              <Button size="sm" className="gap-1.5 rounded-full px-4">
                Get Started
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--nexo-radius-sm)] text-[var(--nexo-nav-link)] hover:bg-[var(--nexo-ghost-hover)] xl:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile full panel */}
      <div
        id="mobile-nav"
        className={cn(
          "fixed inset-0 z-40 xl:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden={!open}
      >
        <button
          type="button"
          aria-label="Close menu backdrop"
          className={cn(
            "absolute inset-0 bg-[var(--nexo-overlay)] transition-opacity duration-[var(--nexo-duration-slow)]",
            open ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setOpen(false)}
        />
        <div
          className={cn(
            "absolute inset-x-0 top-16 bottom-0 flex flex-col border-t border-[var(--nexo-border)] bg-[var(--nexo-bg)] transition-transform duration-[var(--nexo-duration-slow)] ease-[var(--nexo-ease)]",
            open ? "translate-y-0" : "-translate-y-2 opacity-0"
          )}
          style={{ opacity: open ? 1 : 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <nav className="flex-1 overflow-y-auto px-4 py-6 sm:px-6" aria-label="Mobile">
            <ul className="space-y-1">
              {NAV_LINKS.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center justify-between rounded-[var(--nexo-radius)] px-3 py-3 text-body transition-colors hover:bg-[var(--nexo-ghost-hover)]",
                        active
                          ? "font-medium text-[var(--nexo-text)]"
                          : "text-[var(--nexo-text-secondary)]"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <span className="inline-flex items-center gap-2">
                        {link.label}
                        {"badge" in link && link.badge ? (
                          <Badge>{link.badge}</Badge>
                        ) : null}
                      </span>
                      {active ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--nexo-text)]" aria-hidden />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="space-y-3 border-t border-[var(--nexo-divider)] px-4 py-5 sm:px-6">
            <LanguageSelector />
            <div className="grid grid-cols-2 gap-2">
              <Link href="/login" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full rounded-full">
                  Log In
                </Button>
              </Link>
              <Link href="/register" onClick={() => setOpen(false)}>
                <Button className="w-full gap-1.5 rounded-full">
                  Get Started
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            <Link
              href="/contact"
              onClick={() => setOpen(false)}
              className="block text-center text-small text-[var(--nexo-text-muted)] hover:text-[var(--nexo-text)]"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div className="h-16" aria-hidden />
    </>
  );
}
