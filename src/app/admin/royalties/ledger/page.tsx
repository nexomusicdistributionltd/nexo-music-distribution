import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { createClient } from "@/lib/supabase/server";
import { formatMinorUnits, toTransactionKind } from "@/lib/finance/money";
import { FinanceNav } from "@/components/finance/FinanceNav";
import type { MoneyEntryKind } from "@/lib/finance/money";
import { unwrapAdminList } from "@/lib/db/admin-query";
import { normalizePageNumber } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "Royalty ledger",
  robots: { index: false, follow: false },
};

export default async function RoyaltyLedgerPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  await RequireAdmin();
  const sp = (await searchParams) ?? {};
  const page = normalizePageNumber(sp.page);
  const pageSize = 50;
  const from = (page - 1) * pageSize;
  const supabase = await createClient();
  const res = await supabase
    .from("ledger_entries")
    .select(
      "id, kind, amount_minor, currency, description, balance_bucket, source_provider, dsp_code, territory, isrc, upc, period_start, period_end, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  const listed = unwrapAdminList(res);
  const count = res.error ? 0 : (res.count ?? listed.items.length);

  return (
    <div>
      <PageHeader
        title="Royalty ledger"
        description="Immutable append-only entries. Pagination for large lists."
      />
      <FinanceNav />
      {listed.error ? (
        <ErrorState title="Ledger unavailable" description={listed.error} retryHref="/admin/royalties/ledger" />
      ) : listed.items.length === 0 ? (
        <EmptyState
          title="No ledger entries"
          description="NO DATA until royalty imports or adjustments are posted."
        />
      ) : (
        <>
          <p className="mb-2 text-caption text-[var(--nexo-text-muted)]">
            Showing {from + 1}–{from + listed.items.length} of {count}
          </p>
          <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
            {listed.items.map((e) => (
              <li key={e.id} className="px-4 py-3 text-small">
                <div className="flex justify-between gap-3">
                  <span>
                    {toTransactionKind(e.kind as MoneyEntryKind)} · {e.kind} ·{" "}
                    {e.balance_bucket}
                    {e.dsp_code ? ` · ${e.dsp_code}` : ""}
                    {e.territory ? ` · ${e.territory}` : ""}
                  </span>
                  <span className="tabular-nums">
                    {formatMinorUnits(e.amount_minor, e.currency)}
                  </span>
                </div>
                <p className="text-caption text-[var(--nexo-text-muted)]">
                  {e.description || "—"} · {e.isrc || "no ISRC"} · {e.upc || "no UPC"} ·{" "}
                  {e.period_start || "—"}→{e.period_end || "—"} · {e.id}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
