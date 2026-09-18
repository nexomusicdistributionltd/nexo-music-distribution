import type { Metadata } from "next";
import { RequireVerifiedEmail } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { formatMinorUnits, emptyBalancesMessage } from "@/lib/finance/money";
import { EarningsNav } from "@/components/finance/EarningsNav";
import { ownedSales } from "@/lib/provider/owned-data";

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
  const primaryBalance = (balances ?? [])[0] ?? null;
  const primaryCurrency = primaryBalance?.currency ?? "USD";
  const availableMinor = Number(primaryBalance?.available_minor ?? 0);
  const pendingMinor = Number(primaryBalance?.pending_minor ?? 0);
  const paidMinor = Number(primaryBalance?.paid_minor ?? 0);
  let upstreamRows: Record<string, unknown>[] = [];
  try { upstreamRows = await ownedSales(user.userId, "overview"); } catch { /* ledger remains authoritative */ }

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 sm:p-8"><p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--nexo-text-muted)]">Royalties & finance</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Earnings</h1><p className="mt-2 text-small text-[var(--nexo-text-secondary)]">Track posted royalties, available balances, pending earnings and completed payouts.</p></section>
      <EarningsNav />
      <section className="overflow-hidden rounded-[1.6rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 shadow-[var(--nexo-shadow-sm)] sm:p-8">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--nexo-text-muted)]">
          Available royalties
        </p>
        <p className="mt-3 text-5xl font-semibold tracking-[-0.06em] tabular-nums">
          {formatMinorUnits(availableMinor, primaryCurrency)}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div><p className="text-caption text-[var(--nexo-text-muted)]">Pending</p><p className="mt-1 font-medium tabular-nums">{formatMinorUnits(pendingMinor, primaryCurrency)}</p></div>
          <div><p className="text-caption text-[var(--nexo-text-muted)]">Paid</p><p className="mt-1 font-medium tabular-nums">{formatMinorUnits(paidMinor, primaryCurrency)}</p></div>
          <div><p className="text-caption text-[var(--nexo-text-muted)]">Source</p><p className="mt-1 font-medium">{hasRows ? "Posted royalty ledger" : "No posted royalties yet"}</p></div>
        </div>
      </section>
      <Alert>
        Balances are derived from the royalty ledger (available / pending / paid). They are not
        editable fields.
      </Alert>
      {upstreamRows.length ? <Alert>Distribution sales data is connected for releases owned by this account. Nexo ledger balances below remain authoritative for available, pending and paid balances.</Alert> : null}
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
              className="rounded-[1.25rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 shadow-[var(--nexo-shadow-sm)]"
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
