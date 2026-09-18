import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Alert } from "@/components/ui/Alert";
import { ProviderDataTable } from "@/components/admin/ProviderDataTable";
import { createClient } from "@/lib/supabase/server";
import { formatMinorUnits } from "@/lib/finance/money";
import { FinanceNav } from "@/components/finance/FinanceNav";
import { unwrapAdminList } from "@/lib/db/admin-query";
import {
  distributionReference,
  isDistributionAuthorizationError,
} from "@/lib/provider/distribution-reference";

export const metadata: Metadata = {
  title: "Royalties",
  robots: { index: false, follow: false },
};

function errorMessage(result: PromiseSettledResult<unknown>): string | null {
  if (result.status === "fulfilled") return null;
  if (isDistributionAuthorizationError(result.reason, "read:sales")) {
    return "TooLost sales access needs reauthorization. Reconnect the provider and grant read:sales.";
  }
  return result.reason instanceof Error ? result.reason.message : "Provider request failed.";
}

export default async function RoyaltiesPage() {
  await RequireAdmin();
  const supabase = await createClient();

  const [statementsRes, batchesRes, splitRes, salesOverview, salesReleases, salesTracks] =
    await Promise.all([
      supabase.from("royalty_statements").select("*").order("period_end", { ascending: false }).limit(50),
      supabase.from("royalty_import_batches").select("id, source_provider, report_id, status, row_count").order("created_at", { ascending: false }).limit(10),
      supabase.from("royalty_split_rules").select("id", { count: "exact", head: true }),
      Promise.resolve(distributionReference.salesOverview({ page: 1, perPage: 25 })).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason) => ({ status: "rejected" as const, reason })
      ),
      Promise.resolve(distributionReference.salesReleases({ page: 1, perPage: 25 })).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason) => ({ status: "rejected" as const, reason })
      ),
      Promise.resolve(distributionReference.salesTracks({ page: 1, perPage: 25 })).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason) => ({ status: "rejected" as const, reason })
      ),
    ]);

  const statements = unwrapAdminList(statementsRes);
  const batches = unwrapAdminList(batchesRes);
  const loadError = statements.error || batches.error || splitRes.error?.message || null;
  const providerSalesReady =
    salesOverview.status === "fulfilled" ||
    salesReleases.status === "fulfilled" ||
    salesTracks.status === "fulfilled";
  const salesAuthorizationDenied = [salesOverview, salesReleases, salesTracks].some(
    (result) =>
      result.status === "rejected" &&
      isDistributionAuthorizationError(result.reason, "read:sales")
  );

  return (
    <div>
      <PageHeader
        title="Royalties"
        description="Live TooLost sales reporting and Nexo's authoritative internal royalty ledger."
      />
      <FinanceNav />

      <Alert variant={providerSalesReady ? "success" : "warning"} title="TooLost sales feed">
        {providerSalesReady ? (
          "Live provider sales endpoints are responding. These rows are upstream reporting; Nexo ledger balances remain authoritative for amounts available to users."
        ) : salesAuthorizationDenied ? (
          <>
            The live TooLost sales endpoint rejected the stored authorization after an automatic token refresh.{" "}
            <Link href="/api/admin/distribution/connect" className="font-medium underline">
              Reauthorize TooLost with read:sales
            </Link>
            .
          </>
        ) : (
          "TooLost sales reporting is temporarily unavailable. The provider connection will be retried on the next request."
        )}
      </Alert>

      <div className="mb-6 mt-4 flex flex-wrap gap-3 text-small">
        <Link href="/admin/royalties/imports" className="underline-offset-4 hover:underline">
          Import batches ({batches.items.length})
        </Link>
        <Link href="/admin/royalties/ledger" className="underline-offset-4 hover:underline">
          Ledger
        </Link>
        <Link href="/admin/distribution/account" className="underline-offset-4 hover:underline">
          TooLost authorization
        </Link>
        <span className="text-[var(--nexo-text-muted)]">Split rules: {splitRes.count ?? 0}</span>
      </div>

      <div className="space-y-8">
        <ProviderDataTable
          title="Monthly / overview sales"
          description="First live provider page. No estimated royalties are generated."
          payload={salesOverview.status === "fulfilled" ? salesOverview.value : null}
          error={errorMessage(salesOverview)}
        />
        <ProviderDataTable
          title="Sales by release"
          description="Live TooLost release-level sales reporting."
          payload={salesReleases.status === "fulfilled" ? salesReleases.value : null}
          error={errorMessage(salesReleases)}
        />
        <ProviderDataTable
          title="Sales by track"
          description="Live TooLost track-level sales reporting."
          payload={salesTracks.status === "fulfilled" ? salesTracks.value : null}
          error={errorMessage(salesTracks)}
        />
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-h4">Nexo royalty statements</h2>
        {loadError ? (
          <ErrorState title="Royalties unavailable" description={loadError} retryHref="/admin/royalties" />
        ) : statements.items.length === 0 ? (
          <EmptyState
            title="No Nexo royalty statements yet"
            description="Statements appear after real provider reports are reconciled into the append-only Nexo ledger."
          />
        ) : (
          <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
            {statements.items.map((statement) => (
              <li key={statement.id} className="flex justify-between gap-4 px-4 py-3 text-small">
                <span>
                  {statement.period_start} → {statement.period_end} · {statement.status}
                </span>
                <span className="tabular-nums">
                  {formatMinorUnits(statement.closing_minor ?? statement.total_minor, statement.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
