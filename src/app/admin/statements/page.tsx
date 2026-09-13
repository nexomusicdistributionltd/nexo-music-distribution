import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { formatMinorUnits } from "@/lib/finance/money";
import { FinanceNav } from "@/components/finance/FinanceNav";
import { PublishStatementForm } from "@/components/finance/PublishStatementForm";

export const metadata: Metadata = {
  title: "Statements",
  robots: { index: false, follow: false },
};

export default async function StatementsPage() {
  await RequireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("royalty_statements")
    .select("*")
    .order("period_end", { ascending: false })
    .limit(50);

  return (
    <div>
      <PageHeader
        title="Royalty statements"
        description="Opening / earnings / deductions / adjustments / payouts / closing from ledger. Export only real data."
      />
      <FinanceNav />
      <PublishStatementForm />
      {(data ?? []).length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No statements"
            description="Publish a statement from ledger data for an owner + period + currency."
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {(data ?? []).map((s) => (
            <li
              key={s.id}
              className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 text-small"
            >
              <div className="flex justify-between">
                <span>
                  {s.period_start} → {s.period_end} · {s.status} · {s.currency}
                </span>
                <span className="tabular-nums font-medium">
                  closing {formatMinorUnits(s.closing_minor ?? s.total_minor, s.currency)}
                </span>
              </div>
              <p className="mt-1 text-caption text-[var(--nexo-text-muted)] tabular-nums">
                open {formatMinorUnits(s.opening_minor ?? 0, s.currency)} · earn{" "}
                {formatMinorUnits(s.earnings_minor ?? 0, s.currency)} · ded{" "}
                {formatMinorUnits(s.deductions_minor ?? 0, s.currency)} · adj{" "}
                {formatMinorUnits(s.adjustments_minor ?? 0, s.currency)} · pay{" "}
                {formatMinorUnits(s.payouts_minor ?? 0, s.currency)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
