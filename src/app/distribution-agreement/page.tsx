import type { Metadata } from "next";
import Link from "next/link";
import { RequireVerifiedPortal } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { AgreementSigningClient } from "@/components/legal/AgreementSigningClient";
import {
  AGREEMENT_DECLARATIONS,
  AGREEMENT_SECTIONS,
  DISTRIBUTION_AGREEMENT_TITLE,
  DISTRIBUTION_AGREEMENT_VERSION,
} from "@/lib/legal/distribution-agreement";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Distribution agreement",
  robots: { index: false, follow: false },
};

export default async function DistributionAgreementPage() {
  const ctx = await RequireVerifiedPortal();
  const supabase = await createClient();

  const [{ data: verification }, { data: signed }] = await Promise.all([
    supabase
      .from("identity_verifications")
      .select("legal_name, account_type, country_code, verified_at, status")
      .eq("user_id", ctx.userId)
      .maybeSingle(),
    supabase
      .from("distribution_agreement_executions")
      .select("id, agreement_version, client_signed_at, document_sha256")
      .eq("user_id", ctx.userId)
      .eq("agreement_version", DISTRIBUTION_AGREEMENT_VERSION)
      .eq("status", "signed")
      .maybeSingle(),
  ]);

  if (!verification || verification.status !== "verified") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-h2">Identity verification required</h1>
        <p className="mt-3 text-small text-[var(--nexo-text-muted)]">
          The distribution agreement is available after identity verification is approved.
        </p>
        <Link href="/verify-identity" className="mt-5 inline-block underline">
          Open identity verification
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
      <header className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6">
        <p className="text-caption font-semibold uppercase tracking-[0.14em] text-[var(--nexo-text-muted)]">
          Nexo Music Distribution LTD · Agreement {DISTRIBUTION_AGREEMENT_VERSION}
        </p>
        <h1 className="mt-2 text-h2">{DISTRIBUTION_AGREEMENT_TITLE}</h1>
        <p className="mt-3 text-small text-[var(--nexo-text-secondary)]">
          This agreement is mandatory for verified Artist and Label accounts before release
          distribution. Your verified identity record is used for the execution record.
        </p>
      </header>

      {signed ? (
        <section className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6">
          <h2 className="text-h3">Agreement signed</h2>
          <p className="mt-2 text-small text-[var(--nexo-text-muted)]">
            Signed {new Date(signed.client_signed_at).toLocaleString()} · execution hash{" "}
            <span className="font-mono">{signed.document_sha256}</span>
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={`/api/agreements/${signed.id}/download`}
              className="inline-flex h-10 items-center rounded-[var(--nexo-radius)] bg-[var(--nexo-primary)] px-4 text-small font-medium [color:var(--nexo-primary-fg)]"
            >
              Download signed agreement
            </a>
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] px-4 text-small"
            >
              Continue to dashboard
            </Link>
          </div>
        </section>
      ) : (
        <>
          <article className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 sm:p-7">
            <div className="max-h-[38rem] space-y-6 overflow-y-auto pr-2">
              {AGREEMENT_SECTIONS.map((section) => (
                <section key={section.heading}>
                  <h2 className="text-h4">{section.heading}</h2>
                  {section.body.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="mt-2 text-small leading-6 text-[var(--nexo-text-secondary)]"
                    >
                      {paragraph}
                    </p>
                  ))}
                </section>
              ))}
            </div>
          </article>
          <AgreementSigningClient
            legalName={verification.legal_name}
            declarations={AGREEMENT_DECLARATIONS}
          />
        </>
      )}
    </main>
  );
}
