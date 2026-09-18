import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/releases/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { ProviderDataTable } from "@/components/admin/ProviderDataTable";
import { getAdminOperationalCounts } from "@/lib/admin/queries";
import {
  distributionReference,
  providerRows,
} from "@/lib/provider/distribution-reference";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analytics",
  robots: { index: false, follow: false },
};

function settledRows(result: PromiseSettledResult<unknown>) {
  return result.status === "fulfilled" ? providerRows(result.value) : [];
}

export default async function AnalyticsPage() {
  await RequireAdmin();

  const [
    counts,
    analyticsResult,
    salesResult,
    tracksResult,
    releasesResult,
    channelsResult,
    territoriesResult,
    streamRatesResult,
  ] = await Promise.all([
    getAdminOperationalCounts(),
    distributionReference.analyticsOverview().then(
      (value) => ({ status: "fulfilled", value }) as PromiseFulfilledResult<unknown>,
      (reason) => ({ status: "rejected", reason }) as PromiseRejectedResult
    ),
    distributionReference.salesOverview({ page: 1, perPage: 100 }).then(
      (value) => ({ status: "fulfilled", value }) as PromiseFulfilledResult<unknown>,
      (reason) => ({ status: "rejected", reason }) as PromiseRejectedResult
    ),
    distributionReference.salesTracks({ page: 1, perPage: 100 }).then(
      (value) => ({ status: "fulfilled", value }) as PromiseFulfilledResult<unknown>,
      (reason) => ({ status: "rejected", reason }) as PromiseRejectedResult
    ),
    distributionReference.salesReleases({ page: 1, perPage: 100 }).then(
      (value) => ({ status: "fulfilled", value }) as PromiseFulfilledResult<unknown>,
      (reason) => ({ status: "rejected", reason }) as PromiseRejectedResult
    ),
    distributionReference.salesChannels({ page: 1, perPage: 100 }).then(
      (value) => ({ status: "fulfilled", value }) as PromiseFulfilledResult<unknown>,
      (reason) => ({ status: "rejected", reason }) as PromiseRejectedResult
    ),
    distributionReference.salesTerritories({ page: 1, perPage: 100 }).then(
      (value) => ({ status: "fulfilled", value }) as PromiseFulfilledResult<unknown>,
      (reason) => ({ status: "rejected", reason }) as PromiseRejectedResult
    ),
    distributionReference.streamRates({ page: 1, perPage: 100 }).then(
      (value) => ({ status: "fulfilled", value }) as PromiseFulfilledResult<unknown>,
      (reason) => ({ status: "rejected", reason }) as PromiseRejectedResult
    ),
  ]);

  const analyticsRows = settledRows(analyticsResult);
  const salesRows = settledRows(salesResult);
  const trackRows = settledRows(tracksResult);
  const releaseRows = settledRows(releasesResult);
  const channelRows = settledRows(channelsResult);
  const territoryRows = settledRows(territoriesResult);
  const streamRateRows = settledRows(streamRatesResult);

  const providerConnected =
    analyticsResult.status === "fulfilled" || salesResult.status === "fulfilled";
  const hasOps = counts.releases > 0 || counts.artists > 0 || counts.openTickets > 0;

  const providerCards = [
    ["Analytics rows", analyticsRows.length],
    ["Sales overview", salesRows.length],
    ["Track sales", trackRows.length],
    ["Release sales", releaseRows.length],
    ["Stores / services", channelRows.length],
    ["Territories", territoryRows.length],
    ["Stream rates", streamRateRows.length],
  ] as const;

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Distribution performance, catalog operations and reporting from real provider and Nexo records."
      />

      <Alert
        variant={providerConnected ? "success" : "warning"}
        title="Distribution analytics"
      >
        {providerConnected
          ? "Distribution Engine reporting is reachable. Counts below come from live protected API responses and are never synthesized."
          : "Distribution analytics are temporarily unavailable. Nexo operational data remains available below."}
      </Alert>

      <section className="mt-6">
        <h2 className="text-h4">Provider reporting</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          First-page row counts from the protected Sales and Analytics resources. API GET responses
          are cached briefly to protect quota and rate limits.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {providerCards.map(([label, value]) => (
            <StatCard key={label} label={label} value={value} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-h4">Nexo operations</h2>
        <div className="mt-4">
          {!hasOps ? (
            <EmptyState title="No operational analytics data available yet" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Releases" value={counts.releases} />
              <StatCard label="In QC" value={counts.inQc} />
              <StatCard label="Artists" value={counts.artists} />
              <StatCard label="Labels" value={counts.labels} />
            </div>
          )}
        </div>
      </section>

      <div className="mt-8 space-y-8">
        <ProviderDataTable
          title="Live provider analytics"
          description="Rows returned by the protected TooLost analytics resource. No generated stream counts."
          payload={analyticsRows}
        />
        <ProviderDataTable
          title="Sales overview"
          description="Live provider sales rows. Access requires read:sales."
          payload={salesRows}
        />
        <ProviderDataTable
          title="Sales by release"
          description="Live release-level provider reporting."
          payload={releaseRows}
        />
        <ProviderDataTable
          title="Territory reporting"
          description="Live provider territory rows."
          payload={territoryRows}
        />
      </div>

      <p className="mt-8 text-small text-[var(--nexo-text-muted)]">
        Provider authorization and live endpoint diagnostics are available in{" "}
        <Link href="/admin/distribution/account" className="underline">
          Distribution → TooLost account
        </Link>.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-[1.25rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
          <p className="text-caption text-[var(--nexo-text-muted)]">Distribution reporting</p>
          <h2 className="mt-1 text-h4">
            {providerConnected ? "Live connection" : "Temporarily unavailable"}
          </h2>
          <p className="mt-2 text-small text-[var(--nexo-text-secondary)]">
            Streams, sales, release, store, territory and stream-rate reporting are requested from
            the connected Distribution Engine. No placeholder performance figures are generated.
          </p>
        </section>
        <section className="rounded-[1.25rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
          <p className="text-caption text-[var(--nexo-text-muted)]">Account scope</p>
          <h2 className="mt-1 text-h4">Nexo administration</h2>
          <p className="mt-2 text-small text-[var(--nexo-text-secondary)]">
            This admin view may inspect provider-wide Nexo reporting. Artist and label workspaces
            remain restricted to releases, tracks and artists owned by their account.
          </p>
        </section>
      </div>
    </div>
  );
}
