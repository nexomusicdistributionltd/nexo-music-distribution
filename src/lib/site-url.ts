/** Canonical production site URL — never fall back to localhost in prod metadata. */
export const DEFAULT_SITE_URL = "https://nexomusicdistribution.com";

/** Zoho mailbox host — sending identity only, never an auth/app origin. */
const ZOHO_MAIL_HOST = "nexomusicdistro.space";

function hostnameOf(raw: string): string | null {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isForbiddenAuthHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h.endsWith(".local") ||
    h === ZOHO_MAIL_HOST ||
    h.endsWith(`.${ZOHO_MAIL_HOST}`)
  );
}

/**
 * Public site origin for metadata, emails, and auth redirects.
 * Production never uses localhost or the Zoho mailbox domain.
 */
export function getSiteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/$/, "");
  if (!raw) return DEFAULT_SITE_URL;
  try {
    const u = new URL(raw);
    if (isForbiddenAuthHost(u.hostname)) {
      if (process.env.NODE_ENV === "production") return DEFAULT_SITE_URL;
      if (u.hostname.toLowerCase() === ZOHO_MAIL_HOST || u.hostname.toLowerCase().endsWith(`.${ZOHO_MAIL_HOST}`)) {
        return DEFAULT_SITE_URL;
      }
    }
    return u.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function absoluteUrl(path = "/"): string {
  const base = getSiteUrl();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Signup / verify / recovery email targets — never window.location.origin. */
export function authEmailRedirectUrl(path: string): string {
  return absoluteUrl(path);
}

/**
 * Origin used after /auth/callback and /auth/confirm succeed.
 * Production and forbidden hosts always land on the official domain.
 */
export function authAppOrigin(requestOrigin?: string | null): string {
  const canonical = getSiteUrl();
  if (!requestOrigin) return canonical;
  const host = hostnameOf(requestOrigin);
  if (!host || isForbiddenAuthHost(host)) return canonical;
  if (process.env.NODE_ENV === "production") return canonical;
  try {
    return new URL(requestOrigin).origin;
  } catch {
    return canonical;
  }
}
