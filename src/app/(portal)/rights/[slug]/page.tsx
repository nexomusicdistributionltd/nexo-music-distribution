import { PortalFeaturePage } from "@/components/portal/PortalFeaturePage";

export const dynamic = "force-dynamic";

export default async function RightsSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PortalFeaturePage href={`/rights/${slug}`} />;
}
