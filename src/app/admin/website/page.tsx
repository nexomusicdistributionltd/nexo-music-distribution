import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { getWebsiteSetting, listAdminWebsiteReleases } from "@/lib/website/queries";
import { createClient } from "@/lib/supabase/server";
import { WebsiteControlsClient } from "@/components/website/WebsiteControlsClient";
import { HomepageSettingsClient } from "@/components/website/HomepageSettingsClient";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Website",
  robots: { index: false, follow: false },
};

export default async function AdminWebsitePage() {
  await RequireAdmin();
  const releases = await listAdminWebsiteReleases(80);
  const supabase = await createClient();
  const [{ data: artists }, homepage] = await Promise.all([
    supabase
      .from("artist_profiles")
      .select(
        "id, artist_name, stage_name, public_slug, website_published, website_featured, public_tagline"
      )
      .order("artist_name", { ascending: true })
      .limit(80),
    getWebsiteSetting("homepage"),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Website controls"
        description="Feature releases and artists on the public site. Nexo player is primary; DSP links are outbound only. Publishing does not invent LIVE status."
      />
      <div className="mb-4 flex flex-wrap gap-3 text-small">
        <Link href="/admin/partners" className="underline">
          Partners
        </Link>
        <Link href="/admin/blog" className="underline">
          Blog
        </Link>
        <Link href="/admin/pages" className="underline">
          Pages
        </Link>
        <Link href="/admin/videos" className="underline">
          Videos
        </Link>
        <Link href="/admin/distribution/migration" className="underline">
          Catalog migration
        </Link>
      </div>
      <HomepageSettingsClient
        initial={(homepage?.value as Record<string, unknown>) ?? {}}
      />
      <WebsiteControlsClient
        releases={releases as Parameters<typeof WebsiteControlsClient>[0]["releases"]}
        artists={(artists ?? []) as Parameters<typeof WebsiteControlsClient>[0]["artists"]}
      />
    </div>
  );
}
