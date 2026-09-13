/** Canonical production site URL — never fall back to localhost in prod metadata. */
export const DEFAULT_SITE_URL = "https://nexomusicdistribution.com";

export function getSiteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/$/, "");
  if (!raw) return DEFAULT_SITE_URL;
  // Refuse localhost / private-looking hosts for production metadata defaults
  try {
    const u = new URL(raw);
    if (
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname.endsWith(".local")
    ) {
      if (process.env.NODE_ENV === "production") return DEFAULT_SITE_URL;
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
