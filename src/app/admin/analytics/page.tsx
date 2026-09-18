import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/releases/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { getAdminOperationalCounts } from "@/lib/admin/queries";
import { distributionReference } from "@/lib/provider/distribution-reference";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
};

export default async function AnalyticsPage() {
  await RequireAdmin();
  const counts = await getAdminOperationalCounts();
  const [analyticsResult, salesResult] = await Promise.allSettled([
    distributionReference.analytics(),
    distributionReference.salesOverview(),
  ]);
  const providerConnected = analyticsResult.status === "fulfilled" || salesResult.status === "fulfilled";
  const hasOps = counts.releases > 0 || counts.artists > 0 || counts.openTickets > 0;

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Distribution performance, catalog operations and reporting."
      />
      <Alert variant={providerConnected ? "success" : "warning"} title="Distribution analytics">
        {providerConnected ? "Distribution Engine analytics are connected. Reporting uses live provider responses and Nexo operational data." : "Distribution analytics are temporarily unavailable. Nexo operational data remains available below."}
      </Alert>
      <div className="mt-6">
        {!hasOps ? (
          <EmptyState title="No analytics data available yet" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Releases" value={counts.releases} />
            <StatCard label="In QC" value={counts.inQc} />
            <StatCard label="Artists" value={counts.artists} />
            <StatCard label="Labels" value={counts.labels} />
          </div>
        )}
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-2"><section className="rounded-[1.25rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5"><p className="text-caption text-[var(--nexo-text-muted)]">Distribution reporting</p><h2 className="mt-1 text-h4">{providerConnected ? "Live connection" : "Temporarily unavailable"}</h2><p className="mt-2 text-small text-[var(--nexo-text-secondary)]">Streams, sales, release and territory reporting are requested from the connected Distribution Engine. No placeholder performance figures are generated.</p></section><section className="rounded-[1.25rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5"><p className="text-caption text-[var(--nexo-text-muted)]">Account scope</p><h2 className="mt-1 text-h4">Nexo operations</h2><p className="mt-2 text-small text-[var(--nexo-text-secondary)]">Admins retain visibility across Nexo releases, artists, labels, QC, royalties and payout operations.</p></section></div>
    </div>
  );
}
