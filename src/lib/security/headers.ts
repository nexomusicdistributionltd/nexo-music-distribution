import { DEFAULT_SITE_URL, getSiteUrl, isForbiddenAuthHost } from "@/lib/site-url";

/** HTTP security headers compatible with Supabase Auth + storage signed URLs. */

function cspSiteOrigin(): string {
  try {
    const site = getSiteUrl();
    const host = new URL(site).hostname;
    if (isForbiddenAuthHost(host)) return DEFAULT_SITE_URL;
    return site;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function securityHeaders(): Record<string, string> {
  const site = cspSiteOrigin();
  // CSP careful: allow Supabase Auth/storage, inline not needed for most; Next may need 'unsafe-inline' for styles in some setups — keep styles self + google fonts.
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.paddle.com https://sandbox-cdn.paddle.com",
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co ${site} https://*.paddle.com https://sandbox-api.paddle.com https://api.paddle.com`,
    "frame-src 'self' https://*.supabase.co https://www.youtube.com https://www.youtube-nocookie.com https://buy.paddle.com https://sandbox-buy.paddle.com https://*.paddle.com",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ].join("; ");

  return {
    "Content-Security-Policy": csp,
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "camera=(self), microphone=(), geolocation=(), payment=(self \"https://buy.paddle.com\" \"https://sandbox-buy.paddle.com\"), usb=(), interest-cohort=()",
    "X-DNS-Prefetch-Control": "on",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  };
}
