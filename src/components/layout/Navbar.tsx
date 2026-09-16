"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { PUBLIC_NAV_MORE, PUBLIC_NAV_PRIMARY } from "@/lib/site";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);
  const overHero = pathname === "/" && !scrolled && !open;

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    setOpen(false);
    setMoreOpen(false);
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

  const menuLinks = [...PUBLIC_NAV_PRIMARY, ...PUBLIC_NAV_MORE];

  return (
    <>
      <header
        className={cn("pub-nav", overHero ? "pub-nav--hero" : "pub-nav--scrolled")}
      >
        <div className="pub-nav-inner">
          <Logo
            height={30}
            priority
            variant={overHero ? "on-dark" : "auto"}
          />

          <nav
            className="absolute left-1/2 hidden -translate-x-1/2 items-center xl:flex"
            aria-label="Primary"
          >
            {PUBLIC_NAV_PRIMARY.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="pub-nav-link"
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="relative">
              <button
                type="button"
                className="pub-nav-link pub-more-btn"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((v) => !v)}
              >
                More
              </button>
              {moreOpen ? (
                <div className="absolute left-1/2 top-full z-20 mt-2 min-w-[11rem] -translate-x-1/2 border border-[var(--nexo-border)] bg-[var(--nexo-bg)] py-2 shadow-[var(--nexo-shadow)]">
                  {PUBLIC_NAV_MORE.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block px-4 py-2 text-[0.72rem] uppercase tracking-[0.14em] text-[var(--nexo-text-secondary)] hover:text-[var(--nexo-text)]"
                      onClick={() => setMoreOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </nav>

          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <ThemeToggle className={overHero ? "text-[var(--pub-on-media)] hover:bg-white/10" : undefined} />
            <Link href="/login" className="pub-nav-login hidden sm:inline">
              Client login
            </Link>
            <Link href="/register" className="pub-apply hidden sm:inline-flex">
              Apply now
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center xl:hidden",
                overHero ? "text-[var(--pub-on-media)]" : "text-[var(--nexo-text)]"
              )}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </header>

      <div
        id="mobile-nav"
        className="pub-menu xl:hidden"
        data-open={open}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between">
          <Logo height={28} href="/" variant={resolvedTheme === "dark" ? "on-light" : "on-dark"} />
          <button
            type="button"
            className="grid h-10 w-10 place-items-center border border-current"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="mt-10 flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Mobile">
          {menuLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="pub-menu-link"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/register" className="pub-menu-link" onClick={() => setOpen(false)}>
            Apply
          </Link>
        </nav>
        <div className="flex flex-wrap gap-6 pt-6 text-[0.72rem] uppercase tracking-[0.14em]">
          <Link href="/login" onClick={() => setOpen(false)}>
            Client login →
          </Link>
          <Link href="/contact" onClick={() => setOpen(false)}>
            Support →
          </Link>
        </div>
      </div>

      <div className={cn("pub-nav-spacer", overHero && "h-0")} aria-hidden />
    </>
  );
}
