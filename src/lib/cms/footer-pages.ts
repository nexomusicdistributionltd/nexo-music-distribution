import "server-only";

import {
  COOKIES_SECTIONS,
  LEGAL_UPDATED,
  PRIVACY_SECTIONS,
  REFUND_POLICY_SECTIONS,
  TERMS_SECTIONS,
} from "@/lib/legal/copy";
import type { LegalSection } from "@/components/legal/LegalArticle";

export const REQUIRED_FOOTER_PAGE_SLUGS = [
  "terms",
  "privacy",
  "contact",
  "pricing",
  "refund-policy",
  "cookies",
] as const;

const PLACEHOLDER_TEXT: Record<string, string[]> = {
  terms: ["Terms of Service content will be published by NEXO MUSIC DISTRIBUTION LTD."],
  privacy: ["Privacy Policy content will be published by NEXO MUSIC DISTRIBUTION LTD."],
  cookies: ["Cookie Policy content will be published by NEXO MUSIC DISTRIBUTION LTD."],
  "refund-policy": [
    "Review and publish the NEXO Music Distribution Refund Policy from the admin CMS.",
  ],
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sectionsToHtml(sections: LegalSection[]) {
  const sectionHtml = sections
    .map((section) => {
      const paragraphs = section.paragraphs
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join("");
      const bullets = section.bullets?.length
        ? `<ul>${section.bullets
            .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
            .join("")}</ul>`
        : "";
      return `<h2>${escapeHtml(section.heading)}</h2>${paragraphs}${bullets}`;
    })
    .join("");

  return `<p><strong>Last updated:</strong> ${escapeHtml(LEGAL_UPDATED)}</p>${sectionHtml}`;
}

export function footerPageFallbackHtml(slug: string): string | null {
  if (slug === "terms") return sectionsToHtml(TERMS_SECTIONS);
  if (slug === "privacy") return sectionsToHtml(PRIVACY_SECTIONS);
  if (slug === "refund-policy") return sectionsToHtml(REFUND_POLICY_SECTIONS);
  if (slug === "cookies") return sectionsToHtml(COOKIES_SECTIONS);
  return null;
}

export function hydrateFooterPageForAdmin<T extends { slug: string; body_html: string }>(
  page: T
): T {
  const fallback = footerPageFallbackHtml(page.slug);
  if (!fallback) return page;

  const placeholders = PLACEHOLDER_TEXT[page.slug] ?? [];
  const current = page.body_html?.trim() ?? "";
  const isPlaceholder = !current || placeholders.some((marker) => current.includes(marker));

  return isPlaceholder ? { ...page, body_html: fallback } : page;
}
