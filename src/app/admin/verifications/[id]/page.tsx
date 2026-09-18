import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequireAdmin } from "@/lib/auth/guards";
import { isAdministratorRole } from "@/lib/admin/permissions";
import { createServiceClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/admin/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { IdentityReviewForm } from "@/components/admin/IdentityReviewForm";
import { IdentityVerifiedBadge } from "@/components/identity/IdentityVerifiedBadge";
import { IDENTITY_DOCUMENT_LABELS, type IdentityDocumentType } from "@/lib/identity/types";

export const metadata: Metadata = {
  title: "Verification review",
  robots: { index: false, follow: false },
};

export default async function VerificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await RequireAdmin();
  const { id } = await params;
  const service = createServiceClient();

  const { data: verification } = await service
    .from("identity_verifications")
    .select("*,profiles!identity_verifications_user_id_fkey(email,display_name,account_type)")
    .eq("id", id)
    .maybeSingle();
  if (!verification) notFound();

  const { data: submission } = verification.latest_submission_id
    ? await service
        .from("identity_verification_submissions")
        .select("*")
        .eq("id", verification.latest_submission_id)
        .maybeSingle()
    : { data: null };

  const [{ data: riskSignals }, { data: events }] = await Promise.all([
    service
      .from("identity_verification_risk_signals")
      .select("id,signal_type,severity,metadata,created_at")
      .eq("verification_id", verification.id)
      .order("created_at", { ascending: false }),
    service
      .from("identity_verification_events")
      .select("id,event_type,metadata,created_at,actor_user_id,submission_id")
      .eq("verification_id", verification.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const paths = submission
    ? [submission.document_front_path, submission.document_back_path, submission.selfie_path].filter(Boolean) as string[]
    : [];
  const { data: signedRows } = paths.length
    ? await service.storage.from("identity-verification").createSignedUrls(paths, 600)
    : { data: [] as { path: string; signedUrl: string }[] };

  const signed = new Map<string, string>(
    (signedRows ?? [])
      .filter(
        (row): row is { path: string; signedUrl: string } =>
          typeof row.path === "string" && typeof row.signedUrl === "string"
      )
      .map((row) => [row.path, row.signedUrl])
  );
  const profile = verification.profiles as unknown as { email?: string; display_name?: string; account_type?: string } | null;
  const canDecide = isAdministratorRole(ctx.roles);

  return (
    <div className="space-y-6">
      <PageHeader
        title={verification.legal_name}
        description={`${profile?.email || verification.user_id} · ${profile?.account_type || "account"}`}
      />

      {verification.status === "verified" ? (
        <div><IdentityVerifiedBadge /></div>
      ) : null}
      {verification.reason ? (
        <Alert variant={verification.status === "declined" ? "error" : "warning"} title="Review reason">
          {verification.reason}
        </Alert>
      ) : null}

      {(riskSignals ?? []).length > 0 ? (
        <Alert variant="error" title="Automated fraud review flags">
          <ul className="space-y-1">
            {(riskSignals ?? []).map((signal) => (
              <li key={signal.id}>
                {String(signal.signal_type).replace(/_/g, " ")} · {String(signal.severity).toUpperCase()}
              </li>
            ))}
          </ul>
        </Alert>
      ) : (
        <Alert variant="success" title="Automated duplicate-evidence check">
          No duplicate capture hash or same-image reuse signal is currently recorded for this verification.
        </Alert>
      )}

      <section className="grid gap-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Status" value={String(verification.status).replace(/_/g, " ")} />
        <Fact label="Country" value={verification.country_code} />
        <Fact label="Date of birth" value={verification.date_of_birth} />
        <Fact label="Document" value={IDENTITY_DOCUMENT_LABELS[verification.document_type as IdentityDocumentType] ?? verification.document_type} />
      </section>

      {submission ? (
        <section className="space-y-3">
          <h2 className="text-h4">Live camera evidence</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Evidence title="Document front" path={submission.document_front_path} signed={signed} />
            <Evidence title="Document back" path={submission.document_back_path} signed={signed} />
            <Evidence title="Face capture" path={submission.selfie_path} signed={signed} />
          </div>
          <p className="text-caption text-[var(--nexo-text-muted)]">
            Signed evidence links expire automatically. Identity files remain in the private verification bucket.
          </p>
        </section>
      ) : (
        <Alert>No submitted evidence is attached to this verification yet.</Alert>
      )}

      {submission && canDecide ? (
        <IdentityReviewForm verificationId={verification.id} submissionId={submission.id} />
      ) : submission ? (
        <Alert variant="warning">Support staff can inspect verification records; only administrators can make verification decisions.</Alert>
      ) : null}

      {verification.admin_note ? (
        <section className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
          <h2 className="text-h4">Internal note</h2>
          <p className="mt-2 text-small">{verification.admin_note}</p>
        </section>
      ) : null}

      <section className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4">
        <h2 className="text-h4">Verification history</h2>
        {(events ?? []).length === 0 ? (
          <p className="text-small text-[var(--nexo-text-muted)]">No verification events recorded.</p>
        ) : (
          <ol className="space-y-3">
            {(events ?? []).map((event) => (
              <li key={event.id} className="border-l-2 border-[var(--nexo-border)] pl-3">
                <p className="text-small font-medium">{String(event.event_type).replace(/_/g, " ")}</p>
                <p className="text-caption text-[var(--nexo-text-muted)]">
                  {new Date(event.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><p className="text-caption text-[var(--nexo-text-muted)]">{label}</p><p className="mt-1 text-small font-medium capitalize">{value}</p></div>;
}

function Evidence({
  title,
  path,
  signed,
}: {
  title: string;
  path: string | null;
  signed: Map<string, string>;
}) {
  const url = path ? signed.get(path) : null;
  return (
    <div className="overflow-hidden rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
      <div className="aspect-[4/3] bg-black/5">
        {url ? <img src={url} alt={title} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-caption text-[var(--nexo-text-muted)]">No image</div>}
      </div>
      <p className="p-3 text-small font-medium">{title}</p>
    </div>
  );
}
