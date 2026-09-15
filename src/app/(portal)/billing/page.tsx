import type { Metadata } from "next";
import Link from "next/link";
import { RequireRole } from "@/lib/auth/guards";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { ManageBillingButton } from "@/components/billing/ManageBillingButton";
import { billingAccountTypeFromRoles } from "@/lib/billing/eligibility";
import { getBillingEntitlements } from "@/lib/billing/entitlements";
import {
  getOwnBillingCustomer,
  getOwnBillingSubscriptions,
  getOwnBillingTransactions,
  primarySubscription,
} from "@/lib/billing/queries";
import { subscriptionRowToSnapshot } from "@/lib/billing/types";
import { getTier } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};

export default async function BillingPage() {
  const ctx = await RequireRole(["artist", "label"]);
  const accountType = billingAccountTypeFromRoles(ctx.roles, ctx.profile?.account_type);
  const [customer, subscriptions, transactions] = await Promise.all([
    getOwnBillingCustomer(ctx.userId),
    getOwnBillingSubscriptions(ctx.userId),
    getOwnBillingTransactions(ctx.userId, 10),
  ]);
  const primary = primarySubscription(subscriptions);
  const entitlements = getBillingEntitlements({
    accountType,
    subscription: primary ? subscriptionRowToSnapshot(primary) : null,
  });
  const plan = entitlements.planId ? getTier(entitlements.planId) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h2">Plan & billing</h1>
        <p className="mt-1 max-w-2xl text-small text-[var(--nexo-text-muted)]">
          Paid access is granted only after Paddle confirms the subscription. Completing checkout in
          the browser is not enough on its own.
        </p>
      </div>

      <Alert variant={entitlements.paidAccess ? "success" : "default"} title="Current access">
        <p>
          Plan: <strong>{plan?.name ?? (entitlements.grandfathered ? "Grandfathered / Starter" : "None")}</strong>
          {entitlements.status ? ` · Paddle status: ${entitlements.status}` : null}
        </p>
        <p className="mt-2">{entitlements.policy}</p>
        {entitlements.cancelAtPeriodEnd ? (
          <p className="mt-2">Cancellation is scheduled. Access continues until the period ends.</p>
        ) : null}
      </Alert>

      {primary ? (
        <dl className="grid gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 text-small sm:grid-cols-2">
          <div>
            <dt className="text-caption text-[var(--nexo-text-muted)]">Interval</dt>
            <dd>{primary.interval ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-caption text-[var(--nexo-text-muted)]">Current period end</dt>
            <dd>{primary.current_period_ends_at ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-caption text-[var(--nexo-text-muted)]">Trial end</dt>
            <dd>{primary.trial_ends_at ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-caption text-[var(--nexo-text-muted)]">Paddle subscription</dt>
            <dd className="break-all font-mono text-caption">{primary.paddle_subscription_id}</dd>
          </div>
        </dl>
      ) : (
        <EmptyState
          title="No Paddle subscription yet"
          description={
            accountType === "artist"
              ? "You are on Artist Starter (free). Subscribe to Artist Pro from Pricing when you are ready."
              : "Label plans are billed through Paddle. Existing workspace features remain available until you subscribe."
          }
          action={
            <Link href={`/pricing?type=${accountType ?? "artist"}`}>
              <Button className="rounded-full">View plans</Button>
            </Link>
          }
        />
      )}

      {customer ? (
        <div className="space-y-3">
          <h2 className="text-h4">Manage payment method & cancellation</h2>
          <p className="text-small text-[var(--nexo-text-muted)]">
            Opens the Paddle customer portal for the customer ID stored on this account. The browser
            cannot supply a customer ID.
          </p>
          <ManageBillingButton />
        </div>
      ) : null}

      <div>
        <h2 className="text-h4">Recent transactions</h2>
        {transactions.length === 0 ? (
          <p className="mt-2 text-small text-[var(--nexo-text-muted)]">No Paddle transactions recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex justify-between gap-4 px-4 py-3 text-small">
                <span className="break-all font-mono text-caption">{tx.paddle_transaction_id}</span>
                <span>
                  {tx.status}
                  {tx.currency ? ` · ${tx.currency}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
