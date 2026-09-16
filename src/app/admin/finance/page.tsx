import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { ErrorState } from "@/components/ui/ErrorState";
import { createClient } from "@/lib/supabase/server";
import { formatMinorUnits } from "@/lib/finance/money";
import { FinanceNav } from "@/components/finance/FinanceNav";
import { getPaymentConnectionState } from "@/lib/finance/payment";
import { unwrapAdminList, adminListErrorMessage } from "@/lib/db/admin-query";

export const metadata: Metadata = {
  title: "Finance",
  robots: { index: false, follow: false },
};

export default async function FinancePage() {
  await RequireAdmin();
  const supabase = await createClient();
  const payment = getPaymentConnectionState();
  const [ledgerHead, recentRes, balancesRes] = await Promise.all([
    supabase.from("ledger_entries").select("id", { count: "exact", head: true }),
    supabase
      .from("ledger_entries")
      .select("id, amount_minor, currency, kind, description, created_at, balance_bucket")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("ledger_balances").select("*").limit(50),
  ]);
  const recent = unwrapAdminList(recentRes);
  const balances = unwrapAdminList(balancesRes);
  const loadError =
    recent.error ||
    balances.error ||
    (ledgerHead.error ? adminListErrorMessage(ledgerHead.error) : null);

  return (
    <div>
      <PageHeader
        title="Finance"
        description="Ledger uses integer minor units + ISO currency. Append-only; corrections via compensating adjustments."
      />
      <FinanceNav />
      <Alert variant="warning" title="Payment provider">
        {payment.message}
      </Alert>
      {(balances.items).length > 0 ? (
        <ul className="mb-4 mt-4 grid gap-2 sm:grid-cols-2">
          {balances.items.map((b) => (
            <li
              key={`${b.owner_user_id}-${b.currency}`}
              className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-3 text-small"
            >
              <p className="font-medium">{b.currency}</p>
              <p className="tabular-nums text-caption text-[var(--nexo-text-muted)]">
                available {formatMinorUnits(b.available_minor, b.currency)} · pending{" "}
                {formatMinorUnits(b.pending_minor, b.currency)} · paid{" "}
                {formatMinorUnits(b.paid_minor, b.currency)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      {loadError ? (
        <ErrorState
          className="mt-4"
          title="Finance data unavailable"
          description={loadError}
          retryHref="/admin/finance"
        />
      ) : (ledgerHead.count ?? 0) === 0 ? (
        <EmptyState
          title="No financial data available yet"
          description="Ledger entries appear when royalty imports or adjustments are recorded. No fabricated balances."
        />
      ) : (
        <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
            {recent.items.map((e) => (
            <li key={e.id} className="flex justify-between px-4 py-3 text-small">
              <span>
                {e.kind} · {e.balance_bucket} · {e.description || "—"}
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
