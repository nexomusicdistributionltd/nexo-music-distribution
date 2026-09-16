import { PortalFeaturePage } from "@/components/portal/PortalFeaturePage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Upload Music Video", robots: { index: false, follow: false } };

export default async function VideosPage() {
  return <PortalFeaturePage href="/dashboard/videos" />;
}
