import type { Metadata } from "next";
import Link from "next/link";
import { RequireVerifiedPortal } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Signed agreements",
  robots: { index: false, follow: false },
};

export default async function SignedAgreementsPage() {
  const ctx = await RequireVerifiedPortal();
  const db = await createClient();
  const { data } = await db
    .from("distribution_agreement_executions")
    .select("id,agreement_version,account_type,legal_name,client_signed_at,document_sha256,status,voided_at,void_reason")
    .eq("user_id", ctx.userId)
    .order("client_signed_at", { ascending: false });

  const rows = data ?? [];

  return (
    <main className="space-y-6">
      <section>
        <p className="text-caption font-semibold uppercase tracking-[0.14em] text-[var(--nexo-text-muted)]">
          Account
        </p>
        <h1 className="mt-1 text-h2">Signed agreements</h1>
        <p className="mt-2 max-w-2xl text-small text-[var(--nexo-text-secondary)]">
          Every executed Nexo distribution agreement on this account is retained here with its
          execution hash and downloadable signed copy.
        </p>
      </section>

      {rows.length === 0 ? (
        <section className="rounded-[var(--nexo-radius-xl)] border border-dashed border-[var(--nexo-border)] bg-[var(--nexo-card)] p-8">
          <h2 className="text-h4">No signed agreements</h2>
          <p className="mt-2 text-small text-[var(--nexo-text-muted)]">
            Your signed documents will appear here after execution.
          </p>
          <Link href="/distribution-agreement" className="mt-4 inline-block text-small underline-offset-4 hover:underline">
            Open distribution agreement
          </Link>
        </section>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <article
              key={row.id}
              className="rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold">Nexo Distribution Agreement · {row.agreement_version}</h2>
                  <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                    {row.account_type} · {row.legal_name} · signed{" "}
                    {new Date(row.client_signed_at).toLocaleString()}
                  </p>
                  <p className="mt-2 break-all font-mono text-[0.68rem] text-[var(--nexo-text-muted)]">
                    SHA-256 {row.document_sha256}
                  </p>
                  {row.status === "void" ? (
                    <p className="mt-2 text-small">
                      Voided{row.voided_at ? ` ${new Date(row.voided_at).toLocaleString()}` : ""}
                      {row.void_reason ? ` · ${row.void_reason}` : ""}
                    </p>
                  ) : null}
                </div>
                <a
                  href={`/api/agreements/${row.id}/download`}
                  className="inline-flex h-10 items-center rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] px-4 text-small font-medium hover:bg-[var(--nexo-ghost-hover)]"
                >
                  Download signed agreement
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
