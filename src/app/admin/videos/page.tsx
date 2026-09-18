import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { VideosAdminClient } from "@/components/website/VideosAdminClient";
import { listAdminVideos } from "@/lib/website/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Website videos",
  robots: { index: false, follow: false },
};

export default async function AdminVideosPage() {
  await RequireAdmin();
  const supabase = await createClient();

  const [videos, artistsResult, releasesResult] = await Promise.all([
    listAdminVideos(100),
    supabase
      .from("artist_profiles")
      .select("id, artist_name, stage_name")
      .order("artist_name", { ascending: true })
      .limit(250),
    supabase
      .from("releases")
      .select("id, title, primary_artist_name")
      .order("updated_at", { ascending: false })
      .limit(250),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nexo Video"
        description="Add and publish video links inside the Nexo Music Distribution player experience. YouTube, Vimeo and direct video files play inside Nexo; other sources keep Nexo branding and link safely to the original source."
      />
      <p className="text-small">
        <Link href="/admin/website" className="underline">
          ← Website control center
        </Link>
      </p>
      <VideosAdminClient
        videos={videos as Parameters<typeof VideosAdminClient>[0]["videos"]}
        artists={(artistsResult.data ?? []) as Parameters<typeof VideosAdminClient>[0]["artists"]}
        releases={(releasesResult.data ?? []) as Parameters<typeof VideosAdminClient>[0]["releases"]}
      />
    </div>
  );
}
