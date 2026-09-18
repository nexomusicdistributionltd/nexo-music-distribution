import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RequireRole } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/admin";
import { AgreementSigningClient } from "@/components/legal/AgreementSigningClient";
import { agreementBodySections, DISTRIBUTION_AGREEMENT_TITLE } from "@/lib/legal/distribution-agreement";

export const metadata: Metadata = {
  title: "Distribution agreement",
  robots: { index: false, follow: false },
};

export default async function DistributionAgreementPage() {
  const ctx = await RequireRole(["artist", "label"], { allowUnsignedAgreement: true });
  const service = createServiceClient();
  const [{ data: verification }, { data: existing }] = await Promise.all([
    service
      .from("identity_verifications")
      .select("id,legal_name,legal_full_name,status,verified_at")
      .eq("user_id", ctx.userId)
      .maybeSingle(),
    service
      .from("distribution_agreements")
      .select("id,status,signed_at")
      .eq("user_id", ctx.userId)
      .eq("status", "signed")
      .order("signed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!verification || verification.status !== "verified") redirect("/verify-identity");
  const legalName = String(verification.legal_name || verification.legal_full_name || "");

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--nexo-text-muted)]">
          Required before distribution
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">{DISTRIBUTION_AGREEMENT_TITLE}</h1>
        <p className="mt-2 text-small text-[var(--nexo-text-secondary)]">
          Your verified identity is linked to this execution record. The final signed PDF is sealed,
          hashed, stored privately, and available to you and authorized Nexo administrators.
        </p>
      </header>

      {!existing ? (
        <article className="max-h-[34rem] space-y-5 overflow-y-auto rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
          {agreementBodySections().map(([heading, body]) => (
            <section key={heading}>
              <h2 className="text-small font-semibold">{heading}</h2>
              <p className="mt-1 whitespace-pre-wrap text-small leading-6 text-[var(--nexo-text-secondary)]">{body}</p>
            </section>
          ))}
        </article>
      ) : null}

      <AgreementSigningClient legalName={legalName} alreadySignedId={existing?.id ?? null} />
    </main>
  );
}
