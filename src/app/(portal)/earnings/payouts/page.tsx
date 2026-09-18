import type { Metadata } from "next";
import { RequireVerifiedEmail } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMinorUnits } from "@/lib/finance/money";
import { EarningsNav } from "@/components/finance/EarningsNav";
import { PayoutRequestForm } from "@/components/portal/PortalForms";
import { getPaymentConnectionState } from "@/lib/finance/payment";
import { PayoutMethodsClient } from "@/components/finance/PayoutMethodsClient";

export const metadata: Metadata = {
  title: "Payouts",
  robots: { index: false, follow: false },
};

export default async function EarningsPayoutsPage() {
  const user = await RequireVerifiedEmail();
  const payment = getPaymentConnectionState();
  const supabase = await createClient();
  const [{ data }, { data: balances }, { data: payoutMethods }] = await Promise.all([
    supabase
      .from("payouts")
      .select("*")
      .eq("owner_user_id", user.userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("ledger_balances")
      .select("available_minor, currency")
      .eq("owner_user_id", user.userId),
    supabase
      .from("payout_methods")
      .select("id, method_type, display_name, country_code, currency, beneficiary_name, details, provider, is_preferred, status")
      .eq("user_id", user.userId)
      .order("is_preferred", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const primary = (balances ?? [])[0];
  const availableMinor = Number(primary?.available_minor ?? 0);
  const currency = primary?.currency ?? "USD";

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 sm:p-8"><p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--nexo-text-muted)]">Finance</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Payouts</h1><p className="mt-2 text-small text-[var(--nexo-text-secondary)]">Request payment from your available royalty balance and follow each request through review and payment.</p></section>
      <EarningsNav />
      <PayoutMethodsClient methods={(payoutMethods ?? []) as Array<{
        id: string;
        method_type: string;
        display_name: string;
        country_code: string | null;
        currency: string | null;
        beneficiary_name: string;
        details: Record<string, string>;
        provider: string;
        is_preferred: boolean;
        status: string;
      }>} />
      <PayoutRequestForm
        availableMinor={availableMinor}
        currency={currency}
        paymentMessage={payment.message}
      />
      {(data ?? []).length === 0 ? (
        <EmptyState
          title="No payout requests"
          description="Your payout requests and completed payments will appear here."
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
