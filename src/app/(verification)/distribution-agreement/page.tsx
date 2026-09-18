import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RequireRole } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/admin";
import { safeGetEntitlementsForAuth } from "@/lib/billing/queries";
import { Alert } from "@/components/ui/Alert";
import { DistributionAgreementForm } from "@/components/legal/DistributionAgreementForm";
import { DISTRIBUTION_AGREEMENT_VERSION } from "@/lib/legal/distribution-agreement";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Distribution agreement",
  robots: { index: false, follow: false },
};

export default async function DistributionAgreementPage() {
  const ctx = await RequireRole(["artist", "label"], {
    allowUnsignedAgreement: true,
  });
  const service = createServiceClient();

  const [{ data: identity }, { data: company }, { data: existing }] = await Promise.all([
    service
      .from("identity_verifications")
      .select("id,status,legal_name,country_code,verified_at")
      .eq("user_id", ctx.userId)
      .maybeSingle(),
    service
      .from("distribution_agreement_company_authorizations")
      .select("id,agreement_version,authorized_legal_name,authorized_title,authorized_at,metadata")
      .eq("agreement_version", DISTRIBUTION_AGREEMENT_VERSION)
      .eq("is_active", true)
      .maybeSingle(),
    service
      .from("distribution_agreement_executions")
      .select("id,agreement_version,legal_name,plan_id,commission_bps,client_signed_at,document_sha256,status")
      .eq("user_id", ctx.userId)
      .eq("agreement_version", DISTRIBUTION_AGREEMENT_VERSION)
      .eq("status", "signed")
      .maybeSingle(),
  ]);

  if (!identity || identity.status !== "verified" || !identity.verified_at) {
    redirect("/verify-identity");
  }

  if (!company) {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert variant="error" title="Agreement temporarily unavailable">
          Nexo could not load the current company-authorized agreement. No release can be created until the agreement is available.
        </Alert>
      </div>
    );
  }

  if (existing) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6">
          <p className="text-label uppercase tracking-[0.14em] text-[var(--nexo-text-muted)]">Distribution agreement</p>
          <h1 className="mt-2 text-h2">Agreement signed</h1>
          <p className="mt-2 text-small text-[var(--nexo-text-secondary)]">
            Your Nexo Distribution Agreement {existing.agreement_version} is active.
          </p>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <Fact label="Legal name" value={existing.legal_name} />
            <Fact label="Signed" value={new Date(existing.client_signed_at).toLocaleString()} />
            <Fact label="Plan at signing" value={existing.plan_id || "Free / grandfathered"} />
            <Fact label="Nexo commission" value={`${Number(existing.commission_bps) / 100}%`} />
          </dl>
          <div className="mt-5 rounded-lg bg-[var(--nexo-elevated)] p-3">
            <p className="text-caption text-[var(--nexo-text-muted)]">Executed document SHA-256</p>
            <p className="mt-1 break-all font-mono text-[0.7rem]">{existing.document_sha256}</p>
          </div>
          <Link href="/dashboard" className="mt-5 inline-flex rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-black">
            Continue to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const entitlements = await safeGetEntitlementsForAuth(ctx);
  const commissionBps = entitlements.paidAccess ? 1000 : 2000;
  const metadata =
    company.metadata && typeof company.metadata === "object"
      ? (company.metadata as Record<string, unknown>)
      : {};
  const companyLegalName =
    typeof metadata.company === "string" && metadata.company.trim()
      ? metadata.company.trim()
      : "NEXO MUSIC DISTRIBUTION LTD";

  return (
    <DistributionAgreementForm
      legalName={identity.legal_name}
      accountType={ctx.roles.includes("label") ? "label" : "artist"}
      agreementVersion={company.agreement_version}
      commissionBps={commissionBps}
      planId={entitlements.planId}
      companyLegalName={companyLegalName}
      companyAuthorizedName={company.authorized_legal_name}
      companyAuthorizedTitle={company.authorized_title}
    />
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-caption text-[var(--nexo-text-muted)]">{label}</dt><dd className="mt-1 text-small font-medium">{value}</dd></div>;
}
