import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/PageHeader";
import { FinanceNav } from "@/components/finance/FinanceNav";
import { RoyaltyCommissionPolicyForm } from "@/components/finance/RoyaltyCommissionPolicyForm";
import { Alert } from "@/components/ui/Alert";
import { RequireAdminPermission } from "@/lib/auth/guards";
import {
  bpsToPercent,
  getRoyaltyCommissionPolicy,
  listRoyaltyCommissionPolicyHistory,
} from "@/lib/finance/commission-policy";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Royalty commission policy",
  robots: { index: false, follow: false },
};

export default async function RoyaltyCommissionPolicyPage() {
  await RequireAdminPermission("admin:royalties");

  const [policy, history] = await Promise.all([
    getRoyaltyCommissionPolicy(),
    listRoyaltyCommissionPolicyHistory(12),
  ]);

  return (
    <div>
      <PageHeader
        title="Royalty commission"
        description="Set Nexo's royalty percentage separately for paid artists, free artists, paid labels, and free labels."
      />
      <FinanceNav />

      <Alert title="How grouping works">
        Artist Pro is the paid artist group. Artist Starter or an artist with no active paid plan is
        the free artist group. Label Starter and Label Pro are grouped as paid labels. A label
        without an active paid label plan uses the free label percentage.
      </Alert>

      <div className="mt-5">
        <RoyaltyCommissionPolicyForm initial={policy} />
      </div>

      <section className="mt-8">
        <div className="mb-3">
          <h2 className="text-h4">Commission change history</h2>
          <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
            Every saved policy is recorded for audit. Posted royalty ledger entries are immutable
            and keep the rate that was used when they were created.
          </p>
        </div>

        <div className="overflow-x-auto rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          <table className="min-w-full text-left text-small">
            <thead className="bg-[var(--nexo-elevated)] text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">
              <tr>
                <th className="px-4 py-3">Changed</th>
                <th className="px-4 py-3">Artist paid</th>
                <th className="px-4 py-3">Artist free</th>
                <th className="px-4 py-3">Label paid</th>
                <th className="px-4 py-3">Label free</th>
                <th className="px-4 py-3">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--nexo-border)]">
              {history.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-caption">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{bpsToPercent(row.artistPaidBps)}%</td>
                  <td className="px-4 py-3">{bpsToPercent(row.artistFreeBps)}%</td>
                  <td className="px-4 py-3">{bpsToPercent(row.labelPaidBps)}%</td>
                  <td className="px-4 py-3">{bpsToPercent(row.labelFreeBps)}%</td>
                  <td className="max-w-sm px-4 py-3 text-caption text-[var(--nexo-text-muted)]">
                    {row.reason || "No internal note"}
                  </td>
                </tr>
              ))}
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-small text-[var(--nexo-text-muted)]">
                    No commission history yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
