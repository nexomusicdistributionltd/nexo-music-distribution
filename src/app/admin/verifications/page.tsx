import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdministrator } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { IdentityVerificationStatus } from "@/lib/verification/types";

export const metadata: Metadata = {
  title: "Identity verifications",
  robots: { index: false, follow: false },
};

function statusKind(status: IdentityVerificationStatus): "live" | "pending" | "rejected" | "draft" {
  if (status === "verified") return "live";
  if (status === "declined") return "rejected";
  if (status === "draft") return "draft";
  return "pending";
}

export default async function AdminVerificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await RequireAdministrator();
  const query = await searchParams;
  const allowed = new Set([
    "draft",
    "submitted",
    "under_review",
    "additional_information_required",
    "verified",
    "declined",
  ]);
  const status = query.status && allowed.has(query.status) ? query.status : null;

  const supabase = await createClient();
  let request = supabase
    .from("identity_verifications")
    .select(
      "id,user_id,account_type,country_code,legal_full_name,date_of_birth,document_type,status,submitted_at,reviewed_at,created_at,profiles!identity_verifications_user_id_fkey(display_name,email)"
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (status) request = request.eq("status", status);

  const { data, error } = await request;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Identity verifications"
        description="Review live ID and face captures for artist and label accounts. Evidence is stored privately."
      />

      <div className="flex flex-wrap gap-2 text-caption">
        <Link href="/admin/verifications" className="rounded-full border border-[var(--nexo-border)] px-3 py-1.5">
          All
        </Link>
        {["submitted", "under_review", "additional_information_required", "verified", "declined"].map((value) => (
          <Link
            key={value}
            href={`/admin/verifications?status=${value}`}
            className="rounded-full border border-[var(--nexo-border)] px-3 py-1.5 capitalize"
          >
            {value.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      {error ? (
        <EmptyState title="Could not load verifications" description={error.message} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState title="No identity verifications" />
      ) : (
        <div className="overflow-x-auto rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)]">
          <table className="min-w-full text-left text-small">
            <thead className="border-b border-[var(--nexo-border)] text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">
              <tr>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Legal name</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--nexo-divider)]">
              {(data ?? []).map((row) => {
                const profile = row.profiles as unknown as { display_name?: string | null; email?: string | null } | null;
                const currentStatus = row.status as IdentityVerificationStatus;
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/verifications/${row.id}`} className="font-medium underline-offset-4 hover:underline">
                        {profile?.display_name || profile?.email || row.user_id.slice(0, 8)}
                      </Link>
                      <span className="ml-2 text-caption capitalize text-[var(--nexo-text-muted)]">{row.account_type}</span>
                    </td>
                    <td className="px-4 py-3">{row.legal_full_name}</td>
                    <td className="px-4 py-3">{row.country_code}</td>
                    <td className="px-4 py-3 capitalize">{String(row.document_type).replace(/_/g, " ")}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={statusKind(currentStatus)} label={currentStatus.replace(/_/g, " ")} />
                    </td>
                    <td className="px-4 py-3 text-caption text-[var(--nexo-text-muted)]">
                      {row.submitted_at ? new Date(row.submitted_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
