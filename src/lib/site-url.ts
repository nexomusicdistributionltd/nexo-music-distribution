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

function isZohoMailboxHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === ZOHO_MAIL_HOST || h.endsWith(`.${ZOHO_MAIL_HOST}`);
}

/**
 * Public site origin for metadata, emails, and auth redirects.
 * Never fall back to localhost. Production forbids localhost/127.0.0.1
 * env values (throws) rather than emitting them in auth emails.
 */
export function resolveSiteUrl(rawEnv: string, nodeEnv: string): string {
  const raw = rawEnv.trim().replace(/\/$/, "");
  if (!raw) return DEFAULT_SITE_URL;
  try {
    const u = new URL(raw);
    if (isForbiddenAuthHost(u.hostname)) {
      if (isZohoMailboxHost(u.hostname)) return DEFAULT_SITE_URL;
      if (nodeEnv === "production") {
        throw new Error(
          `NEXT_PUBLIC_SITE_URL must be ${DEFAULT_SITE_URL} in production (forbidden host: ${u.hostname})`
        );
      }
    }
    return u.origin;
  } catch (err) {
    if (err instanceof Error && err.message.includes("NEXT_PUBLIC_SITE_URL must be")) {
      throw err;
    }
    return DEFAULT_SITE_URL;
  }
}

export function getSiteUrl(): string {
  return resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? "", process.env.NODE_ENV ?? "");
}

export function absoluteUrl(path = "/"): string {
  const base = getSiteUrl();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function normalizeAuthPath(path: string): string {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Signup / verify / recovery email targets.
 * Always the official production domain — never the browser origin,
 * never localhost, never the Zoho mailbox host. Misconfig throws.
 */
export function authEmailRedirectUrl(path: string): string {
  const url = `${DEFAULT_SITE_URL}${normalizeAuthPath(path)}`;
  const host = hostnameOf(url);
  if (!host || isForbiddenAuthHost(host) || host !== "nexomusicdistribution.com") {
    throw new Error("Refusing to emit an auth email redirect that is not the official production domain");
  }
  return url;
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
