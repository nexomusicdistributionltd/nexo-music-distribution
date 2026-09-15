import { BRAND_LEGAL_NAME, BRAND_PUBLIC_URL, BRAND_SOCIAL_LINKS } from "@/lib/brand/social";
import { LEGAL_CONTACT_EMAIL } from "@/lib/legal/copy";
import type { ReactNode } from "react";

export type LegalSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export function LegalArticle({
  updated,
  sections,
}: {
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <p className="text-small text-[var(--nexo-text-muted)]">Last updated: {updated}</p>
      {sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((p, i) => (
            <p key={`${section.heading}-${i}`}>{p}</p>
          ))}
          {section.bullets?.length ? (
            <ul>
              {section.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
      <footer className="mt-10 border-t border-[var(--nexo-border)] pt-6 not-prose">
        <p className="text-small text-[var(--nexo-text)]">{BRAND_LEGAL_NAME}</p>
        <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
          <a href={BRAND_PUBLIC_URL} className="underline underline-offset-4">
            nexomusicdistribution.com
          </a>
          {" · "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline underline-offset-4">
            {LEGAL_CONTACT_EMAIL}
          </a>
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-caption text-[var(--nexo-text-muted)]">
          {BRAND_SOCIAL_LINKS.map((item) => (
            <li key={item.key}>
              <a
                href={item.href}
                aria-label={item.ariaLabel}
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-[var(--nexo-text)]"
              >
                {item.ariaLabel.replace("Nexo Music Distribution on ", "")}
              </a>
            </li>
          ))}
        </ul>
      </footer>
    </article>
  );
}

export function LegalFallbackNote({ children }: { children?: ReactNode }) {
  return children ? <div className="mb-8">{children}</div> : null;
}
