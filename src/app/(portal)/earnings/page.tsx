import type { Metadata } from "next";
import Link from "next/link";
import { RequireVerifiedEmail } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMinorUnits } from "@/lib/finance/money";
import { EarningsNav } from "@/components/finance/EarningsNav";
import { loadSalesSnapshot } from "@/lib/portal/sales";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Earnings",
  robots: { index: false, follow: false },
};

function formatReportedAmount(amount: number, currency: string | null) {
  if (!currency) {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(amount);
  }

  const code = currency.trim().toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(amount);
  } catch {
    return `${amount.toFixed(6)} ${code}`;
  }
}

export default async function EarningsPage() {
  const user = await RequireVerifiedEmail();
  const supabase = await createClient();
  const [{ data: balances }, { count: ledgerCount }, sales] = await Promise.all([
    supabase.from("ledger_balances").select("*").eq("owner_user_id", user.userId),
    supabase
      .from("ledger_entries")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", user.userId),
    loadSalesSnapshot(user.userId, "overview"),
  ]);

  const hasRows = (ledgerCount ?? 0) > 0;
  const primaryBalance = (balances ?? [])[0] ?? null;
  const primaryCurrency = String(primaryBalance?.currency ?? "USD").trim().toUpperCase();
  const primaryAvailableMinor = Number(primaryBalance?.available_minor ?? 0);

  const reportedTotals = new Map<string, number>();
  if (sales.status === "ready") {
    for (const row of sales.rows) {
      if (row.total == null) continue;
      const currency = row.currency?.trim().toUpperCase() ?? "";
      reportedTotals.set(currency, (reportedTotals.get(currency) ?? 0) + row.total);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 sm:p-8">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--nexo-text-muted)]">
          Royalties & finance
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Earnings</h1>
        <p className="mt-2 text-small text-[var(--nexo-text-secondary)]">
          Track royalties, available balances, pending earnings and completed payouts.
        </p>
      </section>

      <EarningsNav />

      <section className="overflow-hidden rounded-[1.75rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] shadow-[var(--nexo-shadow)]">
        <div className="relative px-6 py-7 sm:px-8 sm:py-9">
          <div
            className="absolute inset-0 bg-gradient-to-br from-[var(--nexo-elevated)] via-transparent to-[var(--nexo-ghost-hover)]"
            aria-hidden
          />
          <div className="relative">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[var(--nexo-text-muted)]">
              Available royalty balance
            </p>
            <p className="mt-3 text-5xl font-semibold tracking-[-0.05em] tabular-nums sm:text-6xl">
              {formatMinorUnits(primaryAvailableMinor, primaryCurrency)}
            </p>
            <p className="mt-3 text-caption text-[var(--nexo-text-muted)]">Available for payout</p>
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

      {(balances ?? []).length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(balances ?? []).map((balance) => (
            <li
              key={balance.currency}
              className="rounded-[1.25rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 shadow-[var(--nexo-shadow-sm)]"
            >
              <p className="font-medium">{balance.currency}</p>
              <p className="mt-2 tabular-nums text-small">
                Available {formatMinorUnits(balance.available_minor, balance.currency)}
              </p>
              <p className="tabular-nums text-caption text-[var(--nexo-text-muted)]">
                Pending {formatMinorUnits(balance.pending_minor, balance.currency)} · Paid{" "}
                {formatMinorUnits(balance.paid_minor, balance.currency)}
                {balance.held_minor
                  ? ` · Held ${formatMinorUnits(balance.held_minor, balance.currency)}`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No payable balance yet"
          description={
            hasRows
              ? "Your royalty balances are being updated."
              : "Your available, pending and paid balances will appear here."
          }
        />
      )}

      {reportedTotals.size > 0 ? (
        <section className="rounded-[1.25rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-h4">Reported royalties</h2>
              <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                Latest sales reporting for your catalog.
              </p>
            </div>
            <Link href="/sales" className="text-small font-medium underline-offset-4 hover:underline">
              View sales details
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[...reportedTotals.entries()].map(([currency, total]) => (
              <div
                key={currency || "reported"}
                className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4"
              >
                <p className="text-caption text-[var(--nexo-text-muted)]">
                  {currency || "Reported earnings"}
                </p>
                <p className="mt-1 text-h3 tabular-nums">
                  {formatReportedAmount(total, currency || null)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
