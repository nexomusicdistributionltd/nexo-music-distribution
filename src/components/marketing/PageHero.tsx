import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Eyebrow } from "@/components/marketing/Section";
import { cn } from "@/lib/utils";

/** Default premium B&W composition so page heroes are not sparse on the right. */
function DefaultHeroVisual() {
  return (
    <div className="relative hidden lg:block" aria-hidden>
      <div
        className="absolute -inset-4 rounded-[1.75rem] border border-[var(--nexo-border)] opacity-50"
      />
      <div className="relative overflow-hidden rounded-[1.35rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 shadow-[var(--nexo-shadow)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.1]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, transparent, transparent 14px, var(--nexo-text) 14px, var(--nexo-text) 15px)",
          }}
        />
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--nexo-border-strong)] bg-[var(--nexo-elevated)] text-caption font-semibold tracking-[0.08em] text-[var(--nexo-text)]">
              N
            </span>
            <span className="text-caption uppercase tracking-[0.14em] text-[var(--nexo-text-muted)]">
              Nexo
            </span>
          </div>
          <p
            className="mt-8 text-2xl italic leading-snug text-[var(--nexo-text-secondary)]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Premium infrastructure
            <br />
            for independent music.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 border-t border-[var(--nexo-divider)] pt-5">
            <div className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] p-3">
              <p className="text-caption text-[var(--nexo-text-muted)]">Reach</p>
              <p className="mt-1 text-h4 text-[var(--nexo-text)]">450+</p>
            </div>
            <div className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] p-3">
              <p className="text-caption text-[var(--nexo-text-muted)]">Focus</p>
              <p className="mt-1 text-h4 text-[var(--nexo-text)]">B&amp;W</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PageHero({
  title,
  description,
  eyebrow,
  crumbs,
  children,
  className,
  aside,
  showAside = true,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  crumbs: { label: string; href?: string }[];
  children?: ReactNode;
  className?: string;
  /** Custom right-column visual. When omitted and showAside is true, a default panel is used. */
  aside?: ReactNode;
  /** Set false for intentionally text-only heroes (rare). */
  showAside?: boolean;
}) {
  const right =
    aside !== undefined ? aside : showAside ? <DefaultHeroVisual /> : null;

  return (
    <div
      className={cn(
        "relative overflow-hidden border-b border-[var(--nexo-border)]",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 85% 0%, color-mix(in srgb, var(--nexo-text) 7%, transparent), transparent 55%)",
        }}
      />
      <div
        className={cn(
          "relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8",
          right
            ? "grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-12"
            : undefined
        )}
      >
        <div>
          <Breadcrumb items={crumbs} />
          {eyebrow ? <Eyebrow className="mt-6">{eyebrow}</Eyebrow> : null}
          <h1 className="mt-3 max-w-3xl text-h1 text-[var(--nexo-text)]">{title}</h1>
          {description ? (
            <p className="mt-4 max-w-2xl text-body text-[var(--nexo-text-muted)]">
              {description}
            </p>
          ) : null}
          {children ? <div className="mt-8">{children}</div> : null}
        </div>
        {right}
      </div>
    </div>
  );
}
