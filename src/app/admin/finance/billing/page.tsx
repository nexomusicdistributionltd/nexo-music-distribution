import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { FinanceNav } from "@/components/finance/FinanceNav";
import { AdminPlanCatalogPanel } from "@/components/admin/AdminPlanCatalogPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { listBillingSubscriptionsAdmin } from "@/lib/billing/queries";
import { billingUserCell } from "@/lib/billing/admin-display";
import { getBillingEntitlements } from "@/lib/billing/entitlements";
import { subscriptionRowToSnapshot } from "@/lib/billing/types";
import type { BillingAccountType } from "@/lib/billing/plans";

export const metadata: Metadata = {
  title: "Billing subscriptions",
  robots: { index: false, follow: false },
};

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; accountType?: string; plan?: string; q?: string }>;
}) {
  await RequireAdminPermission("admin:billing_tools");
  const sp = await searchParams;
  const accountType =
    sp.accountType === "artist" || sp.accountType === "label"
      ? (sp.accountType as BillingAccountType)
      : null;
  const { rows, error } = await listBillingSubscriptionsAdmin({
    status: sp.status || null,
    accountType,
    planId: sp.plan || null,
    q: sp.q || null,
  });

  return (
    <div>
      <PageHeader
        title="Billing / Subscriptions"
        description="Paddle Billing subscriptions mirrored from verified webhooks. No client-writable entitlements."
      />
      <FinanceNav />
      <AdminPlanCatalogPanel />

      <form className="mb-6 flex flex-wrap gap-2 text-small" method="get">
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-3 py-2"
          aria-label="Status"
        >
          <option value="">All statuses</option>
          {["active", "trialing", "past_due", "paused", "canceled"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          name="accountType"
          defaultValue={sp.accountType ?? ""}
          className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-3 py-2"
          aria-label="Account type"
        >
          <option value="">Artists & labels</option>
          <option value="artist">Artist</option>
          <option value="label">Label</option>
        </select>
        <select
          name="plan"
          defaultValue={sp.plan ?? ""}
          className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-3 py-2"
          aria-label="Plan"
        >
          <option value="">All plans</option>
          <option value="artist_pro">Artist Pro</option>
          <option value="label_starter">Label Starter</option>
          <option value="label_pro">Label Pro</option>
        </select>
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Email, name, Paddle sub / customer, user id"
          className="min-w-[16rem] flex-1 rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-3 py-2"
        />
        <button type="submit" className="rounded-full border border-[var(--nexo-border)] px-4 py-2">
          Filter
        </button>
      </form>

      {error ? (
        <ErrorState
          title="Billing list unavailable"
          description={error}
          retryHref="/admin/finance/billing"
        />
      ) : null}

      {!error && rows.length === 0 ? (
        <EmptyState
          title="No billing subscriptions"
          description="Rows appear after verified Paddle webhooks. An empty list after migrations is expected until a real checkout completes — subscriptions are not invented."
        />
      ) : rows.length > 0 ? (
        <div className="overflow-x-auto rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          <table className="min-w-full text-left text-small">
            <thead className="border-b border-[var(--nexo-border)] text-caption uppercase tracking-[0.08em] text-[var(--nexo-text-muted)]">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Access</th>
                <th className="px-3 py-2">Interval</th>
                <th className="px-3 py-2">Period end</th>
                <th className="px-3 py-2">Paddle sub</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const access = getBillingEntitlements({
                  accountType: row.account_type,
                  subscription: subscriptionRowToSnapshot(row),
                });
                const user = billingUserCell(row);
                return (
                <tr key={row.id} className="border-b border-[var(--nexo-divider)]">
                  <td className="px-3 py-2">
                    <span className="block font-medium">{user.title}</span>
                    {user.subtitle ? (
                      <span className="block font-mono text-caption text-[var(--nexo-text-muted)]">
                        {user.subtitle}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{row.account_type}</td>
                  <td className="px-3 py-2">{row.plan_id ?? "—"}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2">
                    {access.paidAccess ? "paid" : "grandfathered"}
                    <span className="block text-caption text-[var(--nexo-text-muted)]">
                      {access.source}
                    </span>
                  </td>
                  <td className="px-3 py-2">{row.interval ?? "—"}</td>
                  <td className="px-3 py-2 text-caption">
                    {row.current_period_ends_at
                      ? new Date(row.current_period_ends_at).toISOString().slice(0, 10)
                      : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-caption">{row.paddle_subscription_id}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

    </div>
  );
}
