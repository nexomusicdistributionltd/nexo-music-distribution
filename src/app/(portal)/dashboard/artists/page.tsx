import { PortalFeaturePage } from "@/components/portal/PortalFeaturePage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Artists", robots: { index: false, follow: false } };

export default async function ArtistSelfPage() {
  return <PortalFeaturePage href="/dashboard/artists" />;
}
