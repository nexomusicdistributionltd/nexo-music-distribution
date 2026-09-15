import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";
import { listPublishedPosts } from "@/lib/blog/queries";
import {
  listPublicArtists,
  listPublicReleases,
} from "@/lib/website/queries";
import { artistCanonicalPath, releaseCanonicalPath } from "@/lib/website/slugs";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE = getSiteUrl();
  const paths = [
    "",
    "/distribution",
    "/publishing",
    "/music",
    "/artists",
    "/labels",
    "/pricing",
    "/services",
    "/about",
    "/contact",
    "/faq",
    "/get-started",
    "/blog",
    "/privacy",
    "/terms",
    "/refund-policy",
    "/cookies",
  ];
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = paths.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/music" || path === "/blog" ? 0.8 : 0.7,
  }));

  let dynamic: MetadataRoute.Sitemap = [];
  try {
    const [posts, releases, artists] = await Promise.all([
      listPublishedPosts(100),
      listPublicReleases(100),
      listPublicArtists(100),
    ]);
    dynamic = [
      ...posts.map((p) => ({
        url: `${BASE}/blog/${p.slug}`,
        lastModified: p.published_at ? new Date(p.published_at) : now,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
      ...releases.map((r) => ({
        url: `${BASE}${releaseCanonicalPath(r.website_slug, r.id)}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
      ...artists
        .filter((a) => a.public_slug)
        .map((a) => ({
          url: `${BASE}${artistCanonicalPath(a.public_slug)}`,
          lastModified: now,
          changeFrequency: "weekly" as const,
          priority: 0.65,
        })),
    ];
  } catch {
    // Soft-fail if tables not migrated yet
  }

  return [...staticEntries, ...dynamic];
}
