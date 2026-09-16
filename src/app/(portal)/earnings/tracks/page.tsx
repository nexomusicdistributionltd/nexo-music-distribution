import { PortalFeaturePage } from "@/components/portal/PortalFeaturePage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tracks", robots: { index: false, follow: false } };

export default async function EarningsTracksPage() {
  return <PortalFeaturePage href="/earnings/tracks" />;
}
