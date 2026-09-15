import * as React from "react";
import {
  BRAND_SOCIAL_LINKS,
  BRAND_SOCIAL_NAV_LABEL,
} from "@/lib/brand/social";
import { BRAND_SOCIAL_ICON_PATHS } from "@/lib/website/social-links";
import { cn } from "@/lib/utils";

export function SocialLinks({ className }: { className?: string }) {
  return (
    <nav aria-label={BRAND_SOCIAL_NAV_LABEL} className={className}>
      <ul className="flex flex-wrap items-center gap-2">
        {BRAND_SOCIAL_LINKS.map((item) => (
          <li key={item.key}>
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={item.ariaLabel}
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center rounded-full",
                "border border-[var(--nexo-border)] text-[var(--nexo-text-muted)]",
                "transition-colors duration-[var(--nexo-duration)]",
                "hover:border-[var(--nexo-border-strong)] hover:bg-[var(--nexo-ghost-hover)] hover:text-[var(--nexo-text)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--nexo-surface)]"
              )}
            >
              <svg
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 fill-current"
                aria-hidden
              >
                <path d={BRAND_SOCIAL_ICON_PATHS[item.key]} />
              </svg>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
