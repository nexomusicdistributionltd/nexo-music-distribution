import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async redirects() {
    return [
      { source: "/for-artists", destination: "/artists", permanent: true },
      { source: "/for-artists/:path*", destination: "/artists", permanent: true },
      { source: "/for-labels", destination: "/labels", permanent: true },
      { source: "/for-labels/:path*", destination: "/labels", permanent: true },
    ];
  },
};

export default nextConfig;
