import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { createClient } from "@/lib/supabase/server";
import { formatMinorUnits } from "@/lib/finance/money";
import { PayoutStatusControls } from "@/components/admin/PayoutStatusControls";
import { FinanceNav } from "@/components/finance/FinanceNav";
import { getPaymentConnectionState } from "@/lib/finance/payment";
import { CreatePayoutForm } from "@/components/finance/CreatePayoutForm";
import type { PayoutStatus } from "@/lib/finance/money";

export const metadata: Metadata = {
  title: "Payouts",
  robots: { index: false, follow: false },
};

export default async function PayoutsPage() {
  await RequireAdmin();
  const supabase = await createClient();
  const payment = getPaymentConnectionState();
  const { data } = await supabase
    .from("payouts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <PageHeader
        title="Payouts"
        description="PENDING → UNDER_REVIEW → APPROVED → PROCESSING → PAID | REJECTED | FAILED. PAID never client-markable."
      />
      <FinanceNav />
      <Alert variant="warning" title="Payment protection">
        {payment.message} Marking PAID requires payment_reference + paid_at from an authorized
        server/provider path.
      </Alert>
      <div className="mt-4">
        <CreatePayoutForm />
      </div>
      {(data ?? []).length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No financial data available yet"
            description="Payout rows appear when created by finance ops after eligibility checks."
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {(data ?? []).map((p) => (
            <li
              key={p.id}
              className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium tabular-nums">
                    {formatMinorUnits(p.amount_minor, p.currency)}
                  </p>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    {p.status} · {p.owner_user_id}
                    {p.compliance_hold ? " · COMPLIANCE HOLD" : ""}
                    {p.payment_reference ? ` · ref ${p.payment_reference}` : ""}
                  </p>
                </div>
                <PayoutStatusControls payoutId={p.id} status={p.status as PayoutStatus} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
