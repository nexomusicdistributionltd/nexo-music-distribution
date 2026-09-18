import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdministrator } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = {
  title: "Distribution agreements",
  robots: { index: false, follow: false },
};

export default async function AdminAgreementsPage() {
  await RequireAdministrator();
  const service = createServiceClient();
  const { data } = await service
    .from("distribution_agreements")
    .select("id,user_id,verification_id,account_type,agreement_version,legal_name,display_name,verified_email,country_code,plan_id,commission_bps,signature_method,signed_at,document_sha256,status")
    .order("signed_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Distribution agreements"
        description="Executed artist and label agreements with verification linkage, audit hash, signature method and downloadable sealed PDF."
      />
      {(data ?? []).length === 0 ? (
        <EmptyState title="No signed agreements yet" />
      ) : (
        <ul className="space-y-3">
          {(data ?? []).map((a) => (
            <li key={a.id} className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{a.legal_name}</p>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    {a.account_type} · {a.verified_email} · {a.country_code} · v{a.agreement_version}
                  </p>
                  <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                    {a.plan_id || "starter"} · Nexo commission {Number(a.commission_bps) / 100}% · {a.signature_method} signature
                  </p>
                  <p className="mt-1 break-all font-mono text-[0.68rem] text-[var(--nexo-text-muted)]">
                    SHA-256 {a.document_sha256 || "pending"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-small">
                  <Link href={`/admin/verifications/${a.verification_id}`} className="underline-offset-4 hover:underline">
                    Verification
                  </Link>
                  <a href={`/api/agreements/${a.id}/download`} className="underline-offset-4 hover:underline">
                    Download PDF
                  </a>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
