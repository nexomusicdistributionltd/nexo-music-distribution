import type { Metadata } from "next";
import { RequireVerifiedPortal } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatMinorUnits } from "@/lib/finance/money";
import { EarningsNav } from "@/components/finance/EarningsNav";
import { PayoutRequestForm } from "@/components/portal/PortalForms";
import {
  PayoutMethodsManager,
  type PayoutMethodSafeRow,
  type PayoutMethodOptionSafeRow,
} from "@/components/finance/PayoutMethodsManager";

export const metadata: Metadata = {
  title: "Payouts",
  robots: { index: false, follow: false },
};

export default async function EarningsPayoutsPage() {
  const user = await RequireVerifiedPortal();
  const supabase = await createClient();

  const [{ data: payouts }, { data: balances }, { data: payoutMethods }, { data: payoutOptions }] =
    await Promise.all([
      supabase
        .from("payouts")
        .select(
          "id,amount_minor,currency,status,paid_at,payment_reference,destination_mask,payout_method_id,created_at"
        )
        .eq("owner_user_id", user.userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("ledger_balances")
        .select("available_minor,currency")
        .eq("owner_user_id", user.userId),
      supabase
        .from("payout_methods")
        .select(
          "id,option_id,method_type,display_name,country_code,currency,beneficiary_name,details,is_preferred,status,created_at"
        )
        .eq("user_id", user.userId)
        .neq("status", "disabled")
        .order("is_preferred", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("payout_method_options")
        .select(
          "id,code,display_name,method_type,destination_label,instructions,requires_institution,requires_country,requires_currency,requires_review,allowed_countries,allowed_currencies"
        )
        .eq("is_enabled", true)
        .order("sort_order", { ascending: true })
        .order("display_name", { ascending: true }),
    ]);

  const primary = (balances ?? [])[0];
  const availableMinor = Number(primary?.available_minor ?? 0);
  const currency = String(primary?.currency ?? "USD").trim();

  const safeMethods: PayoutMethodSafeRow[] = (payoutMethods ?? []).map((row) => {
    const details =
      row.details && typeof row.details === "object" && !Array.isArray(row.details)
        ? (row.details as Record<string, unknown>)
        : {};
    return {
      id: row.id,
      option_id: row.option_id,
      method_type: row.method_type,
      display_name: row.display_name,
      country_code: row.country_code,
      currency: row.currency ? String(row.currency).trim() : null,
      beneficiary_name: row.beneficiary_name,
      destination_mask:
        typeof details.destination_mask === "string"
          ? details.destination_mask
          : "Secure destination",
      is_preferred: row.is_preferred,
      status: row.status,
    };
  });

  const activeMethods = safeMethods.filter((row) => row.status === "active");
  const safeOptions: PayoutMethodOptionSafeRow[] = (payoutOptions ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    display_name: row.display_name,
    method_type: row.method_type,
    destination_label: row.destination_label,
    instructions: row.instructions,
    requires_institution: row.requires_institution,
    requires_country: row.requires_country,
    requires_currency: row.requires_currency,
    requires_review: row.requires_review,
    allowed_countries: row.allowed_countries,
    allowed_currencies: row.allowed_currencies,
  }));

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 sm:p-8">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--nexo-text-muted)]">
          Finance
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Payouts</h1>
        <p className="mt-2 text-small text-[var(--nexo-text-secondary)]">
          Add an approved payout destination, request payment from your available royalty balance,
          and follow each request through Finance review and payment.
        </p>
      </section>

      <EarningsNav />
      <PayoutMethodsManager methods={safeMethods} options={safeOptions} />
      <PayoutRequestForm
        availableMinor={availableMinor}
        currency={currency}
        paymentMessage="Nexo Finance processes approved payout requests using the payout method you select below."
        payoutMethods={activeMethods.map((row) => ({
          id: row.id,
          label: row.display_name,
          methodType: row.method_type,
          destinationMask: row.destination_mask,
          currency: row.currency,
          preferred: row.is_preferred,
        }))}
      />

      {(payouts ?? []).length === 0 ? (
        <EmptyState
          title="No payout requests"
          description="Your payout requests and completed payments will appear here."
        />
      ) : (
        <ul className="space-y-3">
          {(payouts ?? []).map((payout) => (
            <li
              key={payout.id}
              className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 text-small"
            >
              <p className="font-medium tabular-nums">
                {formatMinorUnits(Number(payout.amount_minor), String(payout.currency).trim())}
              </p>
              <p className="text-caption text-[var(--nexo-text-muted)]">
                {String(payout.status).replace(/_/g, " ")}
                {payout.destination_mask ? ` · ${payout.destination_mask}` : ""}
                {payout.paid_at ? ` · paid ${new Date(payout.paid_at).toLocaleString()}` : ""}
                {payout.payment_reference ? ` · ref ${payout.payment_reference}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
