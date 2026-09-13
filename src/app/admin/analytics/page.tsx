import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/releases/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { getAdminOperationalCounts } from "@/lib/admin/queries";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
};

export default async function AnalyticsPage() {
  await RequireAdmin();
  const counts = await getAdminOperationalCounts();
  const hasOps = counts.releases > 0 || counts.artists > 0 || counts.openTickets > 0;

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Operational counts only. Provider / DSP analytics are not connected."
      />
      <Alert title="Provider analytics">
        Stream and DSP charts stay empty until a distribution analytics provider is wired.
        No placeholder stream or revenue figures are shown.
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
      <div className="mt-8">
        <EmptyState
          title="Provider analytics scaffold"
          description="DSP streams, listeners, and revenue will appear here only from a real provider."
        />
      </div>
    </div>
  );
}
