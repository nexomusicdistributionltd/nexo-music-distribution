import type { Metadata } from "next";
import { PortalFeaturePage } from "@/components/portal/PortalFeaturePage";
import { portalPageTitle } from "@/lib/portal/ia";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: portalPageTitle(`/analytics/${slug}`),
    robots: { index: false, follow: false },
  };
}

export default async function AnalyticsSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PortalFeaturePage href={`/analytics/${slug}`} />;
}
