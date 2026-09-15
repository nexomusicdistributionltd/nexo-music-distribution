import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { listAdminWebsiteReleases } from "@/lib/website/queries";
import { createClient } from "@/lib/supabase/server";
import { WebsiteControlsClient } from "@/components/website/WebsiteControlsClient";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Website",
  robots: { index: false, follow: false },
};

export default async function AdminWebsitePage() {
  await RequireAdmin();
  const releases = await listAdminWebsiteReleases(80);
  const supabase = await createClient();
  const { data: artists } = await supabase
    .from("artist_profiles")
    .select(
      "id, artist_name, stage_name, public_slug, website_published, website_featured, public_tagline"
    )
    .order("artist_name", { ascending: true })
    .limit(80);

  return (
    <div>
      <PageHeader
        title="Website controls"
        description="Feature releases and artists on the public site. Publishing does not invent LIVE status."
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
        <Link href="/admin/distribution/migration" className="underline">
          Catalog migration
        </Link>
      </div>
      <WebsiteControlsClient
        releases={releases as Parameters<typeof WebsiteControlsClient>[0]["releases"]}
        artists={(artists ?? []) as Parameters<typeof WebsiteControlsClient>[0]["artists"]}
      />
    </div>
  );
}
