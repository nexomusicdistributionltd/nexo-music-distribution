import type { MetadataRoute } from "next";

const BASE = "https://nexomusicdistribution.com";

export default function sitemap(): MetadataRoute.Sitemap {
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
    "/login",
  ];
  const now = new Date();
  return paths.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
