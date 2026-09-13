import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const BASE = getSiteUrl();
  const paths = [
    "",
    "/distribution",
    "/publishing",
    "/artists",
    "/labels",
    "/pricing",
    "/services",
    "/about",
    "/contact",
    "/faq",
    "/get-started",
  ];
  const now = new Date();
  return paths.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
