import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { formatMinorUnits } from "@/lib/finance/money";
import { FinanceNav } from "@/components/finance/FinanceNav";

export const metadata: Metadata = {
  title: "Royalties",
  robots: { index: false, follow: false },
};

export default async function RoyaltiesPage() {
  await RequireAdmin();
  const supabase = await createClient();
  const [{ data: statements }, { data: batches }, { count: splitCount }] = await Promise.all([
    supabase.from("royalty_statements").select("*").order("period_end", { ascending: false }).limit(50),
    supabase.from("royalty_import_batches").select("id, source_provider, report_id, status, row_count").order("created_at", { ascending: false }).limit(10),
    supabase.from("royalty_split_rules").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div>
      <PageHeader
        title="Royalties"
        description="Statements, imports, and split rules. Adjustments only — no silent deletes."
      />
      <FinanceNav />
      <div className="mb-4 flex flex-wrap gap-3 text-small">
        <Link href="/admin/royalties/imports" className="underline-offset-4 hover:underline">
          Import batches ({(batches ?? []).length})
        </Link>
        <Link href="/admin/royalties/ledger" className="underline-offset-4 hover:underline">
          Ledger
        </Link>
        <span className="text-[var(--nexo-text-muted)]">Split rules: {splitCount ?? 0}</span>
      </div>
      {(statements ?? []).length === 0 ? (
        <EmptyState
          title="No financial data available yet"
          description="Royalty statements will list here when published from real ledger data."
        />
      ) : (
        <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {(statements ?? []).map((s) => (
            <li key={s.id} className="flex justify-between px-4 py-3 text-small">
              <span>
                {s.period_start} → {s.period_end} · {s.status}
              </span>
              <span className="tabular-nums">
                {formatMinorUnits(s.closing_minor ?? s.total_minor, s.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
