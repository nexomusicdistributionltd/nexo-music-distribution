import { APPROVED_TEMPLATE_KEYS, type TemplateKey } from "./types";

/** Uppercase snake keys, 2–63 chars. Used for catalog + admin-created templates. */
export const TEMPLATE_KEY_PATTERN = /^[A-Z][A-Z0-9_]{1,62}$/;

const CATALOG_SET = new Set<string>(APPROVED_TEMPLATE_KEYS);

export function isValidTemplateKeyFormat(key: string): boolean {
  return TEMPLATE_KEY_PATTERN.test(key);
}

export function isAuthTemplateKey(key: string): boolean {
  return key.startsWith("AUTH_");
}

/** Keys the outbox may enqueue (never Auth Go templates). */
export function isEnqueueableTemplateKey(key: string): boolean {
  if (!isValidTemplateKeyFormat(key) || isAuthTemplateKey(key)) return false;
  if (CATALOG_SET.has(key)) return true;
  return true;
}

export function assertEnqueueableTemplateKey(key: string): string {
  const trimmed = key.trim();
  if (!isValidTemplateKeyFormat(trimmed)) {
    throw new Error(`Invalid template key: ${key}`);
  }
  if (isAuthTemplateKey(trimmed)) {
    throw new Error("Auth templates are managed by Supabase, not the outbox.");
  }
  return trimmed;
}

export function slugifyTemplateKey(name: string): string {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  if (!slug) return "CUSTOM_TEMPLATE";
  if (/^[0-9]/.test(slug)) return `CUSTOM_${slug}`;
  if (slug.startsWith("AUTH_")) return `CUSTOM_${slug}`;
  return slug;
}

export function ensureUniqueTemplateKey(
  base: string,
  existing: Iterable<string>
): string {
  const taken = new Set(existing);
  let stem = isAuthTemplateKey(base) ? `CUSTOM_${base}` : base;
  stem = stem.slice(0, 63);
  let key = stem;
  let n = 2;
  while (taken.has(key) || isAuthTemplateKey(key)) {
    const suffix = `_${n++}`;
    key = `${stem.slice(0, Math.max(1, 63 - suffix.length))}${suffix}`;
  }
  return key;
}

export function isCatalogTemplateKey(key: string): key is TemplateKey {
  return CATALOG_SET.has(key);
}

export function isProtectedSeedCategory(
  category: string
): category is "ops" | "newsletter" {
  return category === "ops" || category === "newsletter";
}
