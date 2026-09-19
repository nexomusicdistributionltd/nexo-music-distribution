import type { Metadata } from "next";
import Link from "next/link";
import { RequireVerifiedPortal } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { EarningsNav } from "@/components/finance/EarningsNav";
import { PayoutMethodsManager } from "@/components/finance/PayoutMethodsManager";
import { PayoutRequestPanel } from "@/components/finance/PayoutRequestPanel";
import type { SafePayoutMethodRow } from "@/app/(portal)/earnings/payouts/actions";
import { formatMinorUnitsExact } from "@/lib/finance/exact-money";

export const metadata: Metadata = {
  title: "Payouts",
  robots: { index: false, follow: false },
};

const STATUS_COPY: Record<string, string> = {
  pending: "Your payout request has been received and is awaiting review.",
  under_review: "Nexo Finance is reviewing your payout request.",
  approved: "Your payout has been approved and is awaiting processing.",
  processing: "Your payout is being processed.",
  paid: "Your payout has been completed.",
  failed: "We could not complete this payout. Review the details or contact Nexo Support.",
  rejected: "This payout request was not approved. Open it to review the reason.",
  cancelled: "This payout request was cancelled.",
  returned: "This payout was returned after processing. Open it to review the details.",
  on_hold: "Additional information is required before this payout can continue.",
};

export default async function EarningsPayoutsPage() {
  const user = await RequireVerifiedPortal();
  const supabase = await createClient();

  const [
    { data: payouts },
    { data: balances },
    { data: payoutMethods },
    { data: countries },
    { data: currencies },
    { data: catalogMethods },
    { data: routes },
    { data: fields },
    { data: mobileNetworks },
  ] = await Promise.all([
    supabase
      .from("payouts")
      .select(
        "id,payout_reference,gross_amount_minor,amount_minor,source_currency,currency,destination_currency,net_amount_minor,provider_fee_minor,nexo_fee_minor,fx_fee_minor,status,paid_at,provider_name,provider_transaction_id,destination_mask,failure_reason,rejected_reason,additional_information_reason,created_at"
      )
      .eq("owner_user_id", user.userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("ledger_balances")
      .select("available_minor,currency")
      .eq("owner_user_id", user.userId)
      .order("currency"),
    supabase
      .from("payout_methods")
      .select(
        "id,method_type,route_method_id,display_name,country_code,currency,beneficiary_type,beneficiary_name,destination_mask,institution_name,provider,is_preferred,status,security_hold_until,last_sensitive_change_at,created_at"
      )
      .eq("user_id", user.userId)
      .neq("status", "disabled")
      .order("is_preferred", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("payout_countries")
      .select("iso2,iso3,name,flag,calling_code")
      .eq("enabled", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("payout_currencies")
      .select("code,name,symbol,decimal_precision")
      .eq("enabled", true)
      .order("code"),
    supabase
      .from("payout_method_catalog")
      .select("id,code,name,icon,processing_time_text")
      .eq("enabled", true)
      .eq("maintenance_mode", false)
      .order("display_order"),
    supabase
      .from("payout_provider_routes")
      .select("country_code,currency_code,method_id,beneficiary_type")
      .eq("enabled", true)
      .order("priority"),
    supabase
      .from("payout_method_fields")
      .select(
        "id,country_code,currency_code,method_id,beneficiary_type,field_key,display_label,input_type,required,placeholder,help_text,minimum_length,maximum_length,validation_regex,numeric_only,display_order,encrypted,masked,options"
      )
      .eq("enabled", true)
      .order("display_order"),
    supabase
      .from("payout_mobile_networks")
      .select("country_code,code,name")
      .eq("enabled", true)
      .order("display_order"),
  ]);

  const safeMethods: SafePayoutMethodRow[] = (payoutMethods ?? []).map((row) => ({
    id: row.id,
    method_type: row.method_type,
    route_method_id: row.route_method_id,
    display_name: row.display_name,
    country_code: row.country_code,
    currency: row.currency ? String(row.currency).trim() : null,
    beneficiary_type: row.beneficiary_type,
    beneficiary_name: row.beneficiary_name,
    destination_mask: row.destination_mask || "Secure destination",
    institution_name: row.institution_name,
    provider: row.provider,
    is_preferred: row.is_preferred,
    status: row.status,
    security_hold_until: row.security_hold_until,
    last_sensitive_change_at: row.last_sensitive_change_at,
  }));

  const safeBalances = (balances ?? []).map((row) => ({
    currency: String(row.currency).trim(),
    available_minor: String(row.available_minor ?? 0),
  }));
  const currencyRows = (currencies ?? []).map((row) => ({
    ...row,
    code: String(row.code).trim(),
    decimal_precision: Number(row.decimal_precision),
  }));

  return (
    <div className="space-y-5">
      <section className="rounded-[1.5rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 sm:p-8">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--nexo-text-muted)]">
          Finance
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Royalty payouts</h1>
        <p className="mt-2 max-w-3xl text-small text-[var(--nexo-text-secondary)]">
          Configure secure payout destinations, review real ledger availability and fees, request withdrawals, and track each payout from review through completion.
        </p>
      </section>

      <EarningsNav />

      <PayoutRequestPanel
        balances={safeBalances}
        methods={safeMethods}
        currencies={currencyRows}
      />

      <PayoutMethodsManager
        methods={safeMethods}
        countries={(countries ?? []).map((row) => ({
          ...row,
          iso2: String(row.iso2).trim(),
          iso3: String(row.iso3).trim(),
        }))}
        currencies={currencyRows}
        catalogMethods={catalogMethods ?? []}
        routes={(routes ?? []).map((row) => ({
          ...row,
          country_code: String(row.country_code).trim(),
          currency_code: String(row.currency_code).trim(),
        }))}
        fields={(fields ?? []).map((row) => ({
          ...row,
          country_code: String(row.country_code).trim(),
          currency_code: String(row.currency_code).trim(),
        }))}
        mobileNetworks={(mobileNetworks ?? []).map((row) => ({
          ...row,
          country_code: String(row.country_code).trim(),
        }))}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-h4">Payout history</h2>
            <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
              Statuses reflect real payout records. Approved is not the same as Paid.
            </p>
          </div>
          <Link href="/earnings/payout-history" className="text-small underline-offset-4 hover:underline">
            View full history
          </Link>
        </div>

        {(payouts ?? []).length === 0 ? (
          <EmptyState
            title="No payout requests"
            description="Your payout requests and completed payments will appear here."
          />
        ) : (
          <div className="space-y-3">
            {(payouts ?? []).slice(0, 10).map((payout) => {
              const sourceCurrency = String(payout.source_currency ?? payout.currency).trim();
              const destinationCurrency = String(
                payout.destination_currency ?? payout.currency
              ).trim();
              const sourceConfig = currencyRows.find((item) => item.code === sourceCurrency);
              const destinationConfig = currencyRows.find(
                (item) => item.code === destinationCurrency
              );
              const gross = String(payout.gross_amount_minor ?? payout.amount_minor ?? 0);
              const net = String(payout.net_amount_minor ?? payout.amount_minor ?? 0);
              const status = String(payout.status);
              const reason =
                payout.failure_reason ??
                payout.rejected_reason ??
                payout.additional_information_reason;

              return (
                <Link
                  key={payout.id}
                  href={`/earnings/payout-history/${payout.id}`}
                  className="block rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 transition hover:bg-[var(--nexo-elevated)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {payout.payout_reference ?? "Nexo payout"}
                      </p>
                      <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                        {new Date(payout.created_at).toLocaleString()} · {payout.destination_mask ?? "Secure destination"}
                      </p>
                    </div>
                    <span className="rounded-full border border-[var(--nexo-border)] px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide">
                      {status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 text-small sm:grid-cols-3">
                    <div>
                      <p className="text-caption text-[var(--nexo-text-muted)]">Requested</p>
                      <p className="font-medium tabular-nums">
                        {formatMinorUnitsExact(
                          gross,
                          sourceCurrency,
                          sourceConfig?.decimal_precision ?? 2,
                          sourceConfig?.symbol
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-caption text-[var(--nexo-text-muted)]">Recipient</p>
                      <p className="font-medium tabular-nums">
                        {formatMinorUnitsExact(
                          net,
                          destinationCurrency,
                          destinationConfig?.decimal_precision ?? 2,
                          destinationConfig?.symbol
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-caption text-[var(--nexo-text-muted)]">Provider</p>
                      <p>{payout.provider_name ?? "Routing at review"}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-caption text-[var(--nexo-text-secondary)]">
                    {reason || STATUS_COPY[status] || "Your payout status has been updated."}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
