/**
 * Server-safe HTML sanitization for TipTap / CMS content.
 * Strips scripts, event handlers, and dangerous URLs.
 */

import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "blockquote",
  "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
  "a", "img", "hr", "pre", "code", "span", "div",
  "table", "thead", "tbody", "tr", "th", "td",
];

const ALLOWED_ATTR = [
  "href", "target", "rel", "src", "alt", "title", "class",
  "width", "height", "colspan", "rowspan",
];

export function sanitizeCmsHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target"],
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["style", "onerror", "onclick", "onload"],
  });
}

/** Reject javascript: / data: (non-image) hrefs after sanitize. */
export function isSafeHttpUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const t = url.trim().toLowerCase();
  if (t.startsWith("javascript:") || t.startsWith("vbscript:")) return false;
  if (t.startsWith("data:") && !t.startsWith("data:image/")) return false;
  try {
    const u = new URL(url, "https://nexomusicdistribution.com");
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}
