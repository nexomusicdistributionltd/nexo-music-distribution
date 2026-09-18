import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequireAdministrator } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/admin/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { VerificationReviewControls } from "@/components/admin/VerificationReviewControls";
import { DOCUMENT_LABELS, EVIDENCE_LABELS, type IdentityDocumentType, type IdentityEvidenceType } from "@/lib/verification/types";
import { countryFlag, countryNameForCode } from "@/lib/auth/countries";

export const metadata: Metadata = {
  title: "Verification review",
  robots: { index: false, follow: false },
};

export default async function VerificationReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await RequireAdministrator();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: verification }, { data: evidence }, { data: events }] = await Promise.all([
    supabase
      .from("identity_verifications")
      .select("*, profiles!identity_verifications_user_id_fkey(id,email,full_name,display_name,account_type,identity_verified_at)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("identity_verification_evidence")
      .select("*")
      .eq("verification_id", id)
      .order("captured_at", { ascending: true }),
    supabase
      .from("identity_verification_events")
      .select("id,event_type,details,created_at,actor_user_id")
      .eq("verification_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (!verification) notFound();

  const service = createServiceClient();
  const signed = new Map<string, string>();
  await Promise.all(
    (evidence ?? []).map(async (row) => {
      const { data } = await service.storage
        .from("identity-verification")
        .createSignedUrl(row.storage_path, 15 * 60);
      if (data?.signedUrl) signed.set(row.evidence_type, data.signedUrl);
    })
  );

  const profile = verification.profiles as unknown as {
    id: string;
    email: string;
    full_name: string;
    display_name: string;
    account_type: string;
    identity_verified_at: string | null;
  } | null;

  const countryName = countryNameForCode(verification.country_code) || verification.country_code;

  return (
    <div className="space-y-7">
      <div>
        <Link href="/admin/verifications" className="text-caption underline-offset-4 hover:underline">
          ← Identity verifications
        </Link>
        <PageHeader
          title={verification.legal_full_name}
          description={`${profile?.display_name || profile?.email || "Account"} · ${verification.account_type}`}
        />
      </div>

      <section className="grid gap-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Account email" value={profile?.email || "—"} />
        <Field label="Country" value={`${countryFlag(verification.country_code)} ${countryName}`} />
        <Field label="Date of birth" value={verification.date_of_birth} />
        <Field label="Document" value={DOCUMENT_LABELS[verification.document_type as IdentityDocumentType] ?? verification.document_type} />
        <Field label="Status" value={String(verification.status).replace(/_/g, " ")} />
        <Field label="Submitted" value={verification.submitted_at ? new Date(verification.submitted_at).toLocaleString() : "—"} />
      </section>

      {verification.decline_reason ? (
        <Alert variant="error" title="Decline reason">{verification.decline_reason}</Alert>
      ) : null}
      {verification.additional_information_request ? (
        <Alert variant="warning" title="Additional information requested">
          {verification.additional_information_request}
        </Alert>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-h3">Private verification evidence</h2>
        <p className="text-caption text-[var(--nexo-text-muted)]">
          Signed links expire after 15 minutes. These images are not public profile media.
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          {(["document_front", "document_back", "selfie"] as IdentityEvidenceType[]).map((type) => {
            const row = (evidence ?? []).find((item) => item.evidence_type === type);
            const url = signed.get(type);
            return (
              <article key={type} className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4">
                <h3 className="font-medium">{EVIDENCE_LABELS[type]}</h3>
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={EVIDENCE_LABELS[type]}
                    className={type === "selfie" ? "mt-3 aspect-square w-full rounded-full object-cover" : "mt-3 max-h-[28rem] w-full rounded-[var(--nexo-radius)] object-contain bg-black"}
                  />
                ) : (
                  <Alert variant="warning" className="mt-3">No current capture available.</Alert>
                )}
                {row ? (
                  <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
                    {new Date(row.captured_at).toLocaleString()} · {row.mime_type} · {row.size_bytes ?? 0} bytes
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
        <h2 className="mb-4 text-h3">Administrator review</h2>
        <VerificationReviewControls
          verificationId={verification.id}
          initialRiskNotes={verification.risk_notes}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-h3">Verification audit trail</h2>
        <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)]">
          {(events ?? []).length === 0 ? (
            <p className="p-4 text-small text-[var(--nexo-text-muted)]">No events recorded.</p>
          ) : (
            <ul className="divide-y divide-[var(--nexo-divider)]">
              {(events ?? []).map((event) => (
                <li key={event.id} className="px-4 py-3 text-small">
                  <span className="font-medium">{String(event.event_type).replace(/_/g, " ")}</span>
                  <span className="ml-2 text-caption text-[var(--nexo-text-muted)]">
                    {new Date(event.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-caption text-[var(--nexo-text-muted)]">{label}</p>
      <p className="mt-0.5 text-small font-medium capitalize">{value}</p>
    </div>
  );
}
