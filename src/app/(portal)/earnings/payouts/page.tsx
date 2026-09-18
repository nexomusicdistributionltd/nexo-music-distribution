import type { Metadata } from "next";
import { RequireVerifiedEmail } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMinorUnits } from "@/lib/finance/money";
import { EarningsNav } from "@/components/finance/EarningsNav";
import { PayoutRequestForm } from "@/components/portal/PortalForms";
import { createServiceClient } from "@/lib/supabase/admin";
import { PayoutMethodsManager } from "@/components/finance/PayoutMethodsManager";

export const metadata: Metadata = {
  title: "Payouts",
  robots: { index: false, follow: false },
};

export default async function EarningsPayoutsPage() {
  const user = await RequireVerifiedEmail();
  const supabase = await createClient();
  const service = createServiceClient();
  const [{ data }, { data: balances }, { data: methods }] = await Promise.all([
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
    service
      .from("payout_methods")
      .select("id,method_type,label,destination_mask,is_preferred,status")
      .eq("owner_user_id", user.userId)
      .neq("status", "disabled")
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
      <PayoutMethodsManager methods={methods ?? []} />
      <PayoutRequestForm
        availableMinor={availableMinor}
        currency={currency}
        paymentMessage={
          (methods ?? []).some((method) => method.is_preferred)
            ? "Your preferred payment method will be attached to this request. Nexo finance can process it through an approved payout provider or record a verified manual payment."
            : "Add a preferred payment method above before requesting payment."
        }
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
