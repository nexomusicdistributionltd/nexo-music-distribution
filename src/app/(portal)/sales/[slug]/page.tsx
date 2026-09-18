import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequireVerifiedPortal } from "@/lib/auth/guards";
import { SalesDashboard } from "@/components/portal/SalesDashboard";
import { SALES_PAGE_COPY, type SalesViewKey } from "@/lib/portal/sales";

export const dynamic = "force-dynamic";

const VIEW_BY_SLUG: Record<string, SalesViewKey> = {
  releases: "releases",
  tracks: "tracks",
  "stores-services": "channels",
  artists: "artists",
  territories: "territories",
  "monthly-overviews": "monthly",
  "stream-rate": "stream_rates",
};

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const view = VIEW_BY_SLUG[slug];
  return {
    title: view ? SALES_PAGE_COPY[view].title : "Sales",
    robots: { index: false, follow: false },
  };
}

export default async function SalesDetailPage({ params }: Props) {
  const { slug } = await params;
  const view = VIEW_BY_SLUG[slug];
  if (!view) notFound();
  const ctx = await RequireVerifiedPortal();
  return <SalesDashboard ownerUserId={ctx.userId} view={view} />;
}
