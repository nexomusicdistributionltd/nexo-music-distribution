import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/admin";
import { PageIntro } from "@/components/workspace/PageIntro";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = {
  title: "Distribution agreements",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminAgreementsPage() {
  await RequireAdmin();
  const service = createServiceClient();
  const { data, error } = await service
    .from("distribution_agreement_executions")
    .select("id,user_id,agreement_version,account_type,legal_name,verified_email,country_code,plan_id,commission_bps,client_signed_at,document_sha256,status")
    .order("client_signed_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="People"
        title="Distribution agreements"
        description="Executed Nexo artist and label distribution agreements. Records are tied to verified identity and include an immutable document hash."
      />
      {error ? (
        <div className="rounded-[var(--nexo-radius-lg)] border border-red-500/30 bg-red-500/10 p-4 text-small">
          Could not load agreement records.
        </div>
      ) : (data ?? []).length === 0 ? (
        <EmptyState title="No signed agreements yet" description="Approved artists and labels appear here after electronic signature." />
      ) : (
        <div className="overflow-x-auto rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)]">
          <table className="w-full min-w-[980px] text-left text-small">
            <thead className="border-b border-[var(--nexo-border)] text-caption text-[var(--nexo-text-muted)]">
              <tr>
                <th className="px-4 py-3">Signer</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Nexo commission</th>
                <th className="px-4 py-3">Signed</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">SHA-256</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--nexo-divider)]">
              {(data ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.legal_name}</p>
                    <p className="text-caption text-[var(--nexo-text-muted)]">{row.verified_email}</p>
                  </td>
                  <td className="px-4 py-3 capitalize">{row.account_type}</td>
                  <td className="px-4 py-3">{row.agreement_version}</td>
                  <td className="px-4 py-3">{row.plan_id || "Free / grandfathered"}</td>
                  <td className="px-4 py-3">{Number(row.commission_bps) / 100}%</td>
                  <td className="px-4 py-3">{new Date(row.client_signed_at).toLocaleString()}</td>
                  <td className="px-4 py-3 capitalize">{row.status}</td>
                  <td className="max-w-[15rem] truncate px-4 py-3 font-mono text-[0.65rem]" title={row.document_sha256}>
                    {row.document_sha256}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
