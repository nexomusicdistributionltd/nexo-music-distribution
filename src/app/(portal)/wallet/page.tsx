import type { Metadata } from "next";
import Link from "next/link";
import { RequireVerifiedPortal } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { formatMinorUnits, toTransactionKind, type MoneyEntryKind } from "@/lib/finance/money";
import { WalletCards, ArrowDownLeft, ArrowUpRight, ReceiptText, ChartNoAxesCombined } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wallet",
  robots: { index: false, follow: false },
};

export default async function WalletPage() {
  const ctx = await RequireVerifiedPortal();
  const db = await createClient();

  const [{ data: balances }, { data: entries }, { data: methods }] = await Promise.all([
    db
      .from("ledger_balances")
      .select("available_minor,currency")
      .eq("owner_user_id", ctx.userId)
      .order("currency"),
    db
      .from("ledger_entries")
      .select("id,kind,amount_minor,currency,description,dsp_code,created_at")
      .eq("owner_user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(12),
    db
      .from("payout_methods")
      .select("id,display_name,status,is_preferred,details")
      .eq("user_id", ctx.userId)
      .neq("status", "disabled")
      .order("is_preferred", { ascending: false })
      .limit(5),
  ]);

  const primary = balances?.[0];
  const available = Number(primary?.available_minor ?? 0);
  const currency = String(primary?.currency ?? "USD").trim();
  const activeMethods = (methods ?? []).filter((method) => method.status === "active");

  return (
    <main className="space-y-6">
      <section>
        <p className="text-caption font-semibold uppercase tracking-[0.14em] text-[var(--nexo-text-muted)]">
          Royalties
        </p>
        <h1 className="mt-1 text-h2">Wallet</h1>
      </section>

      <section className="overflow-hidden rounded-[1.5rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] shadow-[var(--nexo-shadow-sm)]">
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-2 text-caption font-semibold uppercase tracking-[0.16em] text-[var(--nexo-text-muted)]">
            <WalletCards className="h-4 w-4" aria-hidden />
            Available balance
          </div>
          <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] tabular-nums">
            {formatMinorUnits(available, currency)}
          </p>
          <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
            Posted royalties only. Pending analytics are not included in your payable balance.
          </p>
        </div>
        <div className="grid border-t border-[var(--nexo-border)] sm:grid-cols-2">
          <Link
            href="/earnings/payouts#payment-methods"
            className="flex items-center justify-center gap-2 border-b border-[var(--nexo-border)] px-5 py-4 text-small font-semibold hover:bg-[var(--nexo-ghost-hover)] sm:border-b-0 sm:border-r"
          >
            + Add payment method
          </Link>
          <Link
            href="/earnings/payouts"
            className="flex items-center justify-center gap-2 px-5 py-4 text-small font-semibold hover:bg-[var(--nexo-ghost-hover)]"
          >
            Request payment
          </Link>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/reports"
          className="flex items-center gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 hover:bg-[var(--nexo-ghost-hover)]"
        >
          <ReceiptText className="h-5 w-5" aria-hidden />
          <span className="font-medium">Reports</span>
        </Link>
        <Link
          href="/sales"
          className="flex items-center gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 hover:bg-[var(--nexo-ghost-hover)]"
        >
          <ChartNoAxesCombined className="h-5 w-5" aria-hidden />
          <span className="font-medium">Sales</span>
        </Link>
      </div>

      <section className="rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-h4">Payment destinations</h2>
            <p className="text-caption text-[var(--nexo-text-muted)]">
              {activeMethods.length
                ? `${activeMethods.length} approved method${activeMethods.length === 1 ? "" : "s"} ready for payouts.`
                : "Add a payout method and complete Finance review before requesting payment."}
            </p>
          </div>
          <Link href="/earnings/payouts#payment-methods" className="text-small underline-offset-4 hover:underline">
            Manage
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-h4">Recent transactions</h2>
            <p className="text-caption text-[var(--nexo-text-muted)]">
              Earnings, adjustments, fees and payouts appear here when posted.
            </p>
          </div>
          <Link href="/earnings/transactions" className="text-caption underline-offset-4 hover:underline">
            View all
          </Link>
        </div>

        {(entries ?? []).length === 0 ? (
          <div className="rounded-[var(--nexo-radius-xl)] border border-dashed border-[var(--nexo-border)] bg-[var(--nexo-card)] px-5 py-16 text-center">
            <div className="mx-auto flex w-fit items-center gap-2">
              <span className="rounded-lg bg-[var(--nexo-elevated)] p-2"><ArrowDownLeft className="h-4 w-4" /></span>
              <span className="rounded-lg bg-[var(--nexo-elevated)] p-2"><ArrowUpRight className="h-4 w-4" /></span>
            </div>
            <p className="mt-4 font-medium">No transactions yet</p>
            <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
              Posted royalties, withdrawals and adjustments will show here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--nexo-divider)] overflow-hidden rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)]">
            {(entries ?? []).map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3 text-small">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {entry.description || toTransactionKind(entry.kind as MoneyEntryKind)}
                  </p>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    {toTransactionKind(entry.kind as MoneyEntryKind)}
                    {entry.dsp_code ? ` · ${entry.dsp_code}` : ""}
                    {" · "}
                    {new Date(entry.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums">
                  {formatMinorUnits(Number(entry.amount_minor), String(entry.currency).trim())}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
