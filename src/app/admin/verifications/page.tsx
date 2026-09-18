import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { IdentityVerificationStatus } from "@/lib/identity/types";

export const metadata: Metadata = {
  title: "Identity verification",
  robots: { index: false, follow: false },
};

function statusKind(status: IdentityVerificationStatus) {
  if (status === "verified") return "live" as const;
  if (status === "declined") return "rejected" as const;
  if (status === "submitted" || status === "under_review" || status === "additional_info_required") return "pending" as const;
  return "draft" as const;
}

export default async function AdminVerificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await RequireAdmin();
  const sp = await searchParams;
  const service = createServiceClient();

  let query = service
    .from("identity_verifications")
    .select("id,user_id,country_code,legal_name,date_of_birth,document_type,status,submitted_at,updated_at,profiles!identity_verifications_user_id_fkey(email,display_name,account_type)")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (sp.status && ["draft","submitted","under_review","verified","declined","additional_info_required"].includes(sp.status)) {
    query = query.eq("status", sp.status);
  }

  const { data } = await query;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Identity verification"
        description="Review live-camera identity submissions for artist and label accounts."
      />
      <div className="flex flex-wrap gap-2 text-caption">
        {["all","submitted","under_review","additional_info_required","verified","declined"].map((status) => (
          <Link
            key={status}
            href={status === "all" ? "/admin/verifications" : `/admin/verifications?status=${status}`}
            className="rounded-full border border-[var(--nexo-border)] px-3 py-1.5 hover:bg-[var(--nexo-ghost-hover)]"
          >
            {status.replace(/_/g, " ")}
          </Link>
        ))}
      </div>
      {(data ?? []).length === 0 ? (
        <EmptyState title="No verification records" />
      ) : (
        <ul className="divide-y divide-[var(--nexo-divider)] overflow-hidden rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)]">
          {(data ?? []).map((row) => {
            const profile = row.profiles as unknown as { email?: string; display_name?: string; account_type?: string } | null;
            return (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{row.legal_name}</p>
                    <StatusBadge status={statusKind(row.status as IdentityVerificationStatus)} label={String(row.status).replace(/_/g, " ")} />
                  </div>
                  <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                    {profile?.email || row.user_id} · {profile?.account_type || "account"} · {row.country_code} · {String(row.document_type).replace(/_/g, " ")}
                  </p>
                </div>
                <Link href={`/admin/verifications/${row.id}`} className="text-small font-medium underline-offset-4 hover:underline">
                  Review
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
