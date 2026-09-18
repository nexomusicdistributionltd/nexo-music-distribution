import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = {
  title: "Distribution agreements",
  robots: { index: false, follow: false },
};

export default async function AdminAgreementsPage() {
  await RequireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("distribution_agreement_executions")
    .select("id, user_id, agreement_version, account_type, legal_name, display_name, verified_email, country_code, commission_bps, client_signed_at, document_sha256, status")
    .order("client_signed_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Distribution agreements"
        description="Tamper-evident Artist and Label agreement executions tied to approved identity records."
      />
      {(data ?? []).length === 0 ? (
        <EmptyState title="No signed agreements yet" />
      ) : (
        <div className="overflow-x-auto rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          <table className="w-full min-w-[900px] text-left text-small">
            <thead className="bg-[var(--nexo-elevated)] text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Plan commission</th>
                <th className="px-4 py-3">Signed</th>
                <th className="px-4 py-3">Hash</th>
                <th className="px-4 py-3">Document</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--nexo-divider)]">
              {(data ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <span className="block font-medium">{row.legal_name}</span>
                    <span className="block text-caption text-[var(--nexo-text-muted)]">
                      {row.display_name || "—"} · {row.verified_email} · {row.country_code}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {row.account_type} · {row.agreement_version}
                  </td>
                  <td className="px-4 py-3">{Number(row.commission_bps) / 100}%</td>
                  <td className="px-4 py-3">
                    {new Date(row.client_signed_at).toLocaleString()}
                  </td>
                  <td className="max-w-[12rem] truncate px-4 py-3 font-mono text-caption">
                    {row.document_sha256}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/api/agreements/${row.id}/download`}
                      className="underline-offset-4 hover:underline"
                    >
                      Download
                    </a>
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
