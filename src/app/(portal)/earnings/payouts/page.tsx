import type { Metadata } from "next";
import { RequireVerifiedEmail } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { formatMinorUnits } from "@/lib/finance/money";
import { EarningsNav } from "@/components/finance/EarningsNav";
import { getPaymentConnectionState } from "@/lib/finance/payment";

export const metadata: Metadata = {
  title: "Payouts",
  robots: { index: false, follow: false },
};

export default async function EarningsPayoutsPage() {
  const user = await RequireVerifiedEmail();
  const payment = getPaymentConnectionState();
  const supabase = await createClient();
  const { data } = await supabase
    .from("payouts")
    .select("*")
    .eq("owner_user_id", user.userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-4">
      <h1 className="text-h2">Payouts</h1>
      <EarningsNav />
      <Alert variant="warning">{payment.message}</Alert>
      {(data ?? []).length === 0 ? (
        <EmptyState
          title="No payouts"
          description="Payout requests appear here when created and eligible. No fabricated payment references."
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
