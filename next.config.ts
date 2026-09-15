import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(self \"https://buy.paddle.com\" \"https://sandbox-buy.paddle.com\"), usb=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Next.js / Supabase Auth need these; avoid breaking login + realtime
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.paddle.com https://sandbox-cdn.paddle.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nexomusicdistribution.com https://*.paddle.com https://sandbox-api.paddle.com https://api.paddle.com",
      "frame-src 'self' https://*.supabase.co https://www.youtube.com https://www.youtube-nocookie.com https://buy.paddle.com https://sandbox-buy.paddle.com https://*.paddle.com",
      "worker-src 'self' blob:",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co", pathname: "/**" },
      { protocol: "https", hostname: "nexomusicdistribution.com", pathname: "/**" },
    ],
  },
  outputFileTracingIncludes: {
    "/admin/ddex/**": ["./src/lib/ddex/xsd/**"],
    "/admin/ddex/download/**": ["./src/lib/ddex/xsd/**"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      // Canonical public URLs (keep legacy paths working via page-level redirects too)
      // Note: /artists remains the For Artists marketing page; only /artists/:slug redirects.
      { source: "/for-artists", destination: "/artists", permanent: true },
      { source: "/for-artists/:path*", destination: "/artists", permanent: true },
      { source: "/for-labels", destination: "/labels", permanent: true },
      { source: "/for-labels/:path*", destination: "/labels", permanent: true },
      { source: "/return-policy", destination: "/refund-policy", permanent: true },
      { source: "/cookie-policy", destination: "/cookies", permanent: true },
    ];
  },
};

export default nextConfig;
