import type { Metadata } from "next";
import { RequireVerifiedEmail } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMinorUnits, toTransactionKind, type MoneyEntryKind } from "@/lib/finance/money";
import { EarningsNav } from "@/components/finance/EarningsNav";

export const metadata: Metadata = {
  title: "Transactions",
  robots: { index: false, follow: false },
};

export default async function EarningsTransactionsPage() {
  const user = await RequireVerifiedEmail();
  const supabase = await createClient();
  const { data } = await supabase
    .from("ledger_entries")
    .select("id, kind, amount_minor, currency, description, created_at, dsp_code")
    .eq("owner_user_id", user.userId)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-4">
      <h1 className="text-h2">Transactions</h1>
      <EarningsNav />
      {(data ?? []).length === 0 ? (
        <EmptyState
          title="No transactions yet"
          description="Royalty, adjustment and payout activity will appear here."
        />
      ) : (
        <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {(data ?? []).map((e) => (
            <li key={e.id} className="flex justify-between px-4 py-3 text-small">
              <span>
                {toTransactionKind(e.kind as MoneyEntryKind)} · {e.description || e.kind}
                {e.dsp_code ? ` · ${e.dsp_code}` : ""}
              </span>
              <span className="tabular-nums">
                {formatMinorUnits(e.amount_minor, e.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
