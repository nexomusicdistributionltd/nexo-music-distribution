import type { Metadata } from "next";
import Link from "next/link";
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
  const primaryCurrency = String(primaryBalance?.currency ?? "USD").trim().toUpperCase();
  const primaryAvailableMinor = Number(primaryBalance?.available_minor ?? 0);
  let upstreamRows: Record<string, unknown>[] = [];
  try { upstreamRows = await ownedSales(user.userId, "overview"); } catch { /* ledger remains authoritative */ }

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 sm:p-8"><p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--nexo-text-muted)]">Royalties & finance</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Earnings</h1><p className="mt-2 text-small text-[var(--nexo-text-secondary)]">Track posted royalties, available balances, pending earnings and completed payouts.</p></section>
      <EarningsNav />

      <section className="overflow-hidden rounded-[1.75rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] shadow-[var(--nexo-shadow)]">
        <div className="relative px-6 py-7 sm:px-8 sm:py-9">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--nexo-elevated)] via-transparent to-[var(--nexo-ghost-hover)]" aria-hidden />
          <div className="relative">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[var(--nexo-text-muted)]">
              Available royalty balance
            </p>
            <p className="mt-3 text-5xl font-semibold tracking-[-0.05em] tabular-nums sm:text-6xl">
              {formatMinorUnits(primaryAvailableMinor, primaryCurrency)}
            </p>
            <p className="mt-3 max-w-xl text-caption text-[var(--nexo-text-muted)]">
              {hasRows
                ? "This is the posted, withdrawable ledger balance. It changes only when real royalty entries, adjustments, holds or payouts are posted."
                : "No royalty entries have been posted yet. The displayed $0.00 is the actual empty ledger state, not an estimated or generated royalty amount."}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/earnings/payouts"
                className="inline-flex h-10 items-center rounded-full bg-[var(--nexo-text)] px-5 text-small font-semibold [color:var(--nexo-text-inverse)]"
              >
                Payment methods & payouts
              </Link>
              <Link
                href="/earnings/statements"
                className="inline-flex h-10 items-center rounded-full border border-[var(--nexo-border)] px-5 text-small font-semibold"
              >
                Statements
              </Link>
            </div>
          </div>
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
