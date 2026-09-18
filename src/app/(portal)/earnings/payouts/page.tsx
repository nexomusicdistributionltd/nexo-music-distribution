import type { Metadata } from "next";
import { RequireVerifiedEmail } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMinorUnits } from "@/lib/finance/money";
import { EarningsNav } from "@/components/finance/EarningsNav";
import { PayoutRequestForm } from "@/components/portal/PortalForms";
import { getPaymentConnectionState } from "@/lib/finance/payment";

export const metadata: Metadata = {
  title: "Payouts",
  robots: { index: false, follow: false },
};

export default async function EarningsPayoutsPage() {
  const user = await RequireVerifiedEmail();
  const payment = getPaymentConnectionState();
  const supabase = await createClient();
  const [{ data }, { data: requests }, { data: balances }] = await Promise.all([
    supabase
      .from("payouts")
      .select("*")
      .eq("owner_user_id", user.userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("payout_requests")
      .select("id, amount_minor, currency, status, created_at, admin_note")
      .eq("owner_user_id", user.userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("ledger_balances")
      .select("available_minor, currency")
      .eq("owner_user_id", user.userId),
  ]);

  const primary = (balances ?? [])[0];
  const availableMinor = Number(primary?.available_minor ?? 0);
  const currency = primary?.currency ?? "USD";

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 sm:p-8"><p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--nexo-text-muted)]">Finance</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Payouts</h1><p className="mt-2 text-small text-[var(--nexo-text-secondary)]">Request payment from your available royalty balance and follow each request through review and payment.</p></section>
      <EarningsNav />
      <PayoutRequestForm
        availableMinor={availableMinor}
        currency={currency}
        paymentMessage={payment.message}
      />
      {(requests ?? []).length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-h4">Your requests</h2>
          <ul className="space-y-2">
            {(requests ?? []).map((r) => (
              <li
                key={r.id}
                className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] px-4 py-3 text-small"
              >
                {formatMinorUnits(r.amount_minor, r.currency)} · {r.status}
                {r.admin_note ? ` · ${r.admin_note}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {(data ?? []).length === 0 ? (
        <EmptyState
          title="No executed payouts"
          description="Staff-executed payouts appear here with a real payment reference. Nothing is fabricated."
        />
      ) : (
        <ul className="space-y-3">
          {(data ?? []).map((p) => (
            <li
              key={p.id}
              className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 text-small"
            >
              <p className="font-medium tabular-nums">
                {formatMinorUnits(p.amount_minor, p.currency)}
              </p>
              <p className="text-caption text-[var(--nexo-text-muted)]">
                {p.status}
                {p.paid_at ? ` · paid ${p.paid_at}` : ""}
                {p.payment_reference ? ` · ${p.payment_reference}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
