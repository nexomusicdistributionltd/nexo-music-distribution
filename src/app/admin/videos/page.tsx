import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { VideosAdminClient } from "@/components/website/VideosAdminClient";
import { listAdminVideos } from "@/lib/website/queries";

export const metadata: Metadata = {
  title: "Website videos",
  robots: { index: false, follow: false },
};

export default async function AdminVideosPage() {
  await RequireAdmin();
  const videos = await listAdminVideos(100);
  return (
    <div>
      <PageHeader
        title="Website videos"
        description="External video URLs shown in Nexo chrome. Never downloaded or re-hosted."
      />
      <p className="mb-4 text-small">
        <Link href="/admin/website" className="underline">
          ← Website controls
        </Link>
      </p>
      <VideosAdminClient videos={videos as Parameters<typeof VideosAdminClient>[0]["videos"]} />
    </div>
  );
}
