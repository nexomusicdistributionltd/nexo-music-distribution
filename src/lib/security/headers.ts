/** HTTP security headers compatible with Supabase Auth + storage signed URLs. */

export function securityHeaders(): Record<string, string> {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://nexomusicdistribution.com").replace(
    /\/$/,
    ""
  );
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
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    `connect-src 'self' https://*.supabase.co wss://*.supabase.co ${site}`,
    "frame-src 'self' https://*.supabase.co",
    "worker-src 'self' blob:",
    "upgrade-insecure-requests",
  ].join("; ");

  return {
    "Content-Security-Policy": csp,
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    "X-DNS-Prefetch-Control": "on",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  };
}
