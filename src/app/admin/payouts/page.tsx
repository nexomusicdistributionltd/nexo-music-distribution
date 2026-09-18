import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { ErrorState } from "@/components/ui/ErrorState";
import { createClient } from "@/lib/supabase/server";
import { formatMinorUnits } from "@/lib/finance/money";
import { PayoutStatusControls } from "@/components/admin/PayoutStatusControls";
import { FinanceNav } from "@/components/finance/FinanceNav";
import { getPaymentConnectionState } from "@/lib/finance/payment";
import { CreatePayoutForm } from "@/components/finance/CreatePayoutForm";
import type { PayoutStatus } from "@/lib/finance/money";
import { AdminPayoutMethodForm } from "@/components/finance/AdminPayoutMethodForm";
import { createServiceClient } from "@/lib/supabase/admin";
import { unwrapAdminList } from "@/lib/db/admin-query";

export const metadata: Metadata = {
  title: "Payouts",
  robots: { index: false, follow: false },
};

export default async function PayoutsPage() {
  await RequireAdmin();
  const supabase = await createClient();
  const service = createServiceClient();
  const payment = getPaymentConnectionState();
  const [payoutResult, methodsResult] = await Promise.all([
    supabase.from("payouts").select("*").order("created_at", { ascending: false }).limit(50),
    service.from("payout_methods").select("id,owner_user_id,method_type,label,destination_mask,is_preferred,source,status,created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  const listed = unwrapAdminList(payoutResult);
  const methods = methodsResult.data ?? [];

  return (
    <div>
      <PageHeader
        title="Payouts"
        description="PENDING → UNDER_REVIEW → APPROVED → PROCESSING → PAID | REJECTED | FAILED. PAID never client-markable."
      />
      <FinanceNav />
      <Alert variant="warning" title="Payment protection">
        {payment.connected
          ? "Automated payment provider is available."
          : "Automated provider payout may be unavailable; finance can still record a real externally completed/manual payment using its actual payment reference."}
        {" "}PAID always requires an immutable payment reference and server-side finance action.
      </Alert>
      <div className="mt-4 space-y-4">
        <CreatePayoutForm />
        <AdminPayoutMethodForm />
      </div>
      {methods.length > 0 ? (
        <section className="mt-6 space-y-2">
          <h2 className="text-h4">Configured payout methods</h2>
          <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
            {methods.map((method) => (
              <li key={method.id} className="px-4 py-3 text-small">
                <p className="font-medium">{method.label} {method.is_preferred ? "· Preferred" : ""}</p>
                <p className="text-caption text-[var(--nexo-text-muted)]">{method.owner_user_id} · {String(method.method_type).replace(/_/g, " ")} · {method.destination_mask || "secure"} · {method.source} · {method.status}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {listed.error ? (
        <div className="mt-4">
          <ErrorState title="Payouts unavailable" description={listed.error} retryHref="/admin/payouts" />
        </div>
      ) : listed.items.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No financial data available yet"
            description="Payout rows appear when created by finance ops after eligibility checks."
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {listed.items.map((p) => (
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
