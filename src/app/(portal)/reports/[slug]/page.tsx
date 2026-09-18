import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RequireVerifiedPortal } from "@/lib/auth/guards";
import { PageIntro } from "@/components/workspace/PageIntro";
import { EmptyState } from "@/components/ui/EmptyState";
import { ownedSales } from "@/lib/provider/owned-data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const REDIRECTS: Record<string, string> = {
  sales: "/sales",
  catalog: "/dashboard/releases",
  payouts: "/earnings/payouts",
  "release-links": "/dashboard/fanlinks",
  "stream-data": "/analytics/streams",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const labels: Record<string, string> = {
    sales: "Sales Report",
    catalog: "Catalog Report",
    payouts: "Payout Report",
    "release-links": "Release Links",
    additional: "Additional Reports",
    "stream-data": "Stream Data",
    "raw-data": "Raw Data",
  };
  return {
    title: labels[slug] ?? "Reports",
    robots: { index: false, follow: false },
  };
}

function cleanRow(row: Record<string, unknown>): Record<string, unknown> {
  const blocked = new Set([
    "provider_release_id",
    "providerReleaseId",
    "provider_id",
    "providerId",
    "internal_id",
  ]);
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => !blocked.has(key))
      .filter(([, value]) => value == null || ["string", "number", "boolean"].includes(typeof value))
  );
}

export default async function ReportDetailPage({ params }: Props) {
  const { slug } = await params;
  const target = REDIRECTS[slug];
  if (target) redirect(target);

  const ctx = await RequireVerifiedPortal();

  if (slug === "additional") {
    return (
      <div className="space-y-6">
        <PageIntro
          eyebrow="Reports"
          title="Additional Reports"
          description="Additional real reporting views available from the connected distribution provider and Nexo ledger."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Monthly Overviews", "/sales/monthly-overviews", "Monthly sales totals scoped to your releases."],
            ["Stream Rate", "/sales/stream-rate", "Provider-reported stream-rate reference data."],
            ["Analytics", "/analytics", "Verified stream and platform analytics."],
            ["Royalty Summary", "/earnings", "Posted Nexo royalty ledger and balances."],
          ].map(([label, href, description]) => (
            <Link
              key={href}
              href={href}
              className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 hover:bg-[var(--nexo-ghost-hover)]"
            >
              <p className="font-medium">{label}</p>
              <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">{description}</p>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (slug === "raw-data") {
    const [releases, tracks, channels, territories] = await Promise.all([
      ownedSales(ctx.userId, "releases").catch(() => []),
      ownedSales(ctx.userId, "tracks").catch(() => []),
      ownedSales(ctx.userId, "channels").catch(() => []),
      ownedSales(ctx.userId, "territories").catch(() => []),
    ]);
    const rows = [...releases, ...tracks, ...channels, ...territories]
      .slice(0, 250)
      .map(cleanRow);

    return (
      <div className="space-y-6">
        <PageIntro
          eyebrow="Reports"
          title="Raw Data"
          description="Read-only provider fields scoped to your owned catalog. Internal provider identifiers and secrets are removed."
        />
        {rows.length === 0 ? (
          <EmptyState
            title="No raw rows available"
            description="Nothing is generated. Rows appear only when the connected provider returns data for this account."
          />
        ) : (
          <div className="overflow-x-auto rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4">
            <pre className="min-w-[40rem] whitespace-pre-wrap break-words text-xs leading-5">
              {JSON.stringify(rows, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }

  notFound();
}
