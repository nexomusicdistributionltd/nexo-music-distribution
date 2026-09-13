import type { Metadata } from "next";
import { RequireVerifiedEmail } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { formatMinorUnits, emptyBalancesMessage } from "@/lib/finance/money";
import { EarningsNav } from "@/components/finance/EarningsNav";

export const metadata: Metadata = {
  title: "Earnings",
  robots: { index: false, follow: false },
};

export default async function EarningsPage() {
  const user = await RequireVerifiedEmail();
  const supabase = await createClient();
  const [{ data: balances }, { count: ledgerCount }] = await Promise.all([
    supabase.from("ledger_balances").select("*").eq("owner_user_id", user.userId),
    supabase
      .from("ledger_entries")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", user.userId),
  ]);

  const hasRows = (ledgerCount ?? 0) > 0;

  return (
    <div className="space-y-4">
      <h1 className="text-h2">Earnings</h1>
      <EarningsNav />
      <Alert>
        Balances are derived from the royalty ledger (available / pending / paid). They are not
        editable fields.
      </Alert>
      {!hasRows ? (
        <EmptyState
          title="No financial data available yet"
          description={emptyBalancesMessage(false)}
        />
      ) : (balances ?? []).length === 0 ? (
        <EmptyState
          title="No balances calculated"
          description={emptyBalancesMessage(true)}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(balances ?? []).map((b) => (
            <li
              key={b.currency}
              className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4"
            >
              <p className="font-medium">{b.currency}</p>
              <p className="mt-2 tabular-nums text-small">
                Available {formatMinorUnits(b.available_minor, b.currency)}
              </p>
              <p className="tabular-nums text-caption text-[var(--nexo-text-muted)]">
                Pending {formatMinorUnits(b.pending_minor, b.currency)} · Paid{" "}
                {formatMinorUnits(b.paid_minor, b.currency)}
                {b.held_minor ? ` · Held ${formatMinorUnits(b.held_minor, b.currency)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
