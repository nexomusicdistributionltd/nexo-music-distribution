import { FOOTER_SOCIAL_LINKS } from "@/lib/website/social-links";
import { cn } from "@/lib/utils";

export function SocialLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Nexo Music Distribution on social media" className={className}>
      <ul className="flex flex-wrap items-center gap-2">
        {FOOTER_SOCIAL_LINKS.map((item) => (
          <li key={item.key}>
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={item.label}
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
                <path d={item.path} />
              </svg>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
