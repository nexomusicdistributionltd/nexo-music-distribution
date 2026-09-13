import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { createClient } from "@/lib/supabase/server";
import { formatMinorUnits } from "@/lib/finance/money";
import { PayoutStatusControls } from "@/components/admin/PayoutStatusControls";

export const metadata: Metadata = {
  title: "Payouts",
  robots: { index: false, follow: false },
};

export default async function PayoutsPage() {
  await RequireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("payouts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <PageHeader
        title="Payouts"
        description="Statuses: PENDING → … → PAID. Marking PAID is blocked without a real payment operation."
      />
      <Alert variant="warning" title="Payment protection">
        The UI never offers a one-click PAID action. Database constraints require
        payment_reference and paid_at from a real payment op.
      </Alert>
      {(data ?? []).length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No financial data available yet" description="Payout rows will appear when created by finance ops." />
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
                  </p>
                </div>
                <PayoutStatusControls payoutId={p.id} status={p.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
