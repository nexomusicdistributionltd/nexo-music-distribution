import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { getWebsiteSetting, listAdminWebsiteReleases } from "@/lib/website/queries";
import { createClient } from "@/lib/supabase/server";
import { WebsiteControlsClient } from "@/components/website/WebsiteControlsClient";
import { HomepageSettingsClient } from "@/components/website/HomepageSettingsClient";

export const metadata: Metadata = {
  title: "Website CMS",
  robots: { index: false, follow: false },
};

const CMS_SECTIONS = [
  {
    title: "Website",
    href: "/admin/website",
    description: "Homepage copy, imagery, section visibility, featured artists and featured music.",
    key: "website",
  },
  {
    title: "Partners",
    href: "/admin/partners",
    description: "Partner logos, links, ordering and homepage partner visibility.",
    key: "partners",
  },
  {
    title: "Blog",
    href: "/admin/blog",
    description: "Create, edit, draft and publish Nexo articles to the public website.",
    key: "blog",
  },
  {
    title: "Pages",
    href: "/admin/pages",
    description: "Footer content plus legal and custom CMS pages.",
    key: "pages",
  },
  {
    title: "Videos",
    href: "/admin/videos",
    description: "Nexo-branded video library, artist/release associations and publishing.",
    key: "videos",
  },
] as const;

export default async function AdminWebsitePage() {
  await RequireAdmin();
  const supabase = await createClient();

  const [
    releases,
    artistsResult,
    homepage,
    partnersResult,
    postsResult,
    pagesResult,
    videosResult,
  ] = await Promise.all([
    listAdminWebsiteReleases(120),
    supabase
      .from("artist_profiles")
      .select(
        "id, artist_name, stage_name, public_slug, website_published, website_featured, public_tagline"
      )
      .order("artist_name", { ascending: true })
      .limit(120),
    getWebsiteSetting("homepage"),
    supabase.from("website_partners").select("id", { count: "exact", head: true }),
    supabase
      .from("blog_posts")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    supabase
      .from("cms_pages")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),
    supabase
      .from("website_videos")
      .select("id", { count: "exact", head: true })
      .eq("published", true),
  ]);

  const artists = artistsResult.data ?? [];
  const publishedReleases = releases.filter((release) => release.website_published).length;
  const featuredReleases = releases.filter((release) => release.website_featured).length;
  const publishedArtists = artists.filter((artist) => artist.website_published).length;
  const featuredArtists = artists.filter((artist) => artist.website_featured).length;

  const counts: Record<(typeof CMS_SECTIONS)[number]["key"], string> = {
    website: `${publishedArtists} artists · ${publishedReleases} music`,
    partners: `${partnersResult.count ?? 0} configured`,
    blog: `${postsResult.count ?? 0} published`,
    pages: `${pagesResult.count ?? 0} published`,
    videos: `${videosResult.count ?? 0} published`,
  };

  return (
    <div className="space-y-10">
      <PageHeader
        title="Website control center"
        description="Manage the Nexo Music Distribution public website from one CMS. Published changes are read from Supabase in realtime and public pages refresh from the same source of truth."
      />

      <section>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {CMS_SECTIONS.map((section) => (
            <Link
              key={section.key}
              href={section.href}
              className="group flex min-h-44 flex-col justify-between rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4 transition hover:border-[var(--nexo-border-strong)]"
            >
              <div>
                <p className="text-h4">{section.title}</p>
                <p className="mt-2 text-caption leading-5 text-[var(--nexo-text-muted)]">
                  {section.description}
                </p>
              </div>
              <div className="mt-5 flex items-center justify-between gap-2 border-t border-[var(--nexo-divider)] pt-3">
                <span className="text-caption font-medium text-[var(--nexo-text-secondary)]">
                  {counts[section.key]}
                </span>
                <span className="text-caption transition group-hover:translate-x-0.5">Open →</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Published artists", publishedArtists],
          ["Featured artists", featuredArtists],
          ["Published music", publishedReleases],
          ["Featured music", featuredReleases],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4"
          >
            <p className="text-caption uppercase tracking-[0.12em] text-[var(--nexo-text-muted)]">
              {label}
            </p>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <HomepageSettingsClient
        initial={(homepage?.value as Record<string, unknown>) ?? {}}
      />

      <WebsiteControlsClient
        releases={releases as Parameters<typeof WebsiteControlsClient>[0]["releases"]}
        artists={artists as Parameters<typeof WebsiteControlsClient>[0]["artists"]}
      />
    </div>
  );
}
