"use server";

import { revalidatePath } from "next/cache";
import { RequireRole } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/admin";
import type { IdentityDocumentType } from "@/lib/identity/types";
import { IDENTITY_COUNTRY_CODES } from "@/lib/identity/countries";

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const DOCUMENT_TYPES = new Set<IdentityDocumentType>([
  "nin",
  "national_id",
  "drivers_license",
  "passport",
]);

function validDateOfBirth(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  const min = new Date("1900-01-01T00:00:00Z");
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);
  return date >= min && date <= today;
}

export async function beginIdentityVerificationAction(input: {
  countryCode: string;
  legalName: string;
  dateOfBirth: string;
  documentType: IdentityDocumentType;
}): Promise<ActionResult<{ verificationId: string; submissionId: string }>> {
  const ctx = await RequireRole(["artist", "label"]);
  const countryCode = input.countryCode.trim().toUpperCase();
  const legalName = input.legalName.trim();

  if (!(IDENTITY_COUNTRY_CODES as readonly string[]).includes(countryCode)) {
    return { ok: false, error: "Select a valid country." };
  }
  if (legalName.length < 2 || legalName.length > 160) {
    return { ok: false, error: "Enter the full legal name shown on the identity document." };
  }
  if (!validDateOfBirth(input.dateOfBirth)) {
    return { ok: false, error: "Enter a valid date of birth." };
  }
  if (!DOCUMENT_TYPES.has(input.documentType)) {
    return { ok: false, error: "Select a valid identity document." };
  }

  const service = createServiceClient();
  const { data: existing, error: existingError } = await service
    .from("identity_verifications")
    .select("id,status")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (existingError) return { ok: false, error: "Could not start identity verification." };

  if (existing?.status === "verified") {
    return { ok: false, error: "This account is already verified." };
  }
  if (existing?.status === "submitted" || existing?.status === "under_review") {
    return { ok: false, error: "Your identity verification is already being reviewed." };
  }

  let verificationId = existing?.id as string | undefined;
  if (!verificationId) {
    const { data: created, error } = await service
      .from("identity_verifications")
      .insert({
        user_id: ctx.userId,
        country_code: countryCode,
        legal_name: legalName,
        date_of_birth: input.dateOfBirth,
        document_type: input.documentType,
        status: "draft",
      })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: "Could not start identity verification." };
    verificationId = created.id;
  } else {
    const { error } = await service
      .from("identity_verifications")
      .update({
        country_code: countryCode,
        legal_name: legalName,
        date_of_birth: input.dateOfBirth,
        document_type: input.documentType,
        status: "draft",
        reason: null,
        admin_note: null,
        reviewed_by: null,
        reviewed_at: null,
      })
      .eq("id", verificationId)
      .eq("user_id", ctx.userId);
    if (error) return { ok: false, error: "Could not update identity verification." };
  }

  const { data: submission, error: submissionError } = await service
    .from("identity_verification_submissions")
    .insert({
      verification_id: verificationId,
      user_id: ctx.userId,
      document_type: input.documentType,
      status: "draft",
    })
    .select("id")
    .single();
  if (submissionError || !submission) {
    return { ok: false, error: "Could not create identity verification attempt." };
  }

  await service
    .from("identity_verifications")
    .update({ latest_submission_id: submission.id })
    .eq("id", verificationId)
    .eq("user_id", ctx.userId);

  await service.from("identity_verification_events").insert({
    verification_id: verificationId,
    submission_id: submission.id,
    user_id: ctx.userId,
    actor_user_id: ctx.userId,
    event_type: "verification_started",
    metadata: { document_type: input.documentType, country_code: countryCode },
  });

  return { ok: true, data: { verificationId, submissionId: submission.id } };
}

export async function submitIdentityVerificationAction(input: {
  verificationId: string;
  submissionId: string;
  documentFrontPath: string;
  documentBackPath: string;
  selfiePath: string;
}): Promise<ActionResult<{ status: "submitted" }>> {
  const ctx = await RequireRole(["artist", "label"]);
  const expectedPrefix = `${ctx.userId}/${input.submissionId}/`;
  const paths = [input.documentFrontPath, input.documentBackPath, input.selfiePath];

  if (paths.some((path) => !path.startsWith(expectedPrefix))) {
    return { ok: false, error: "Identity evidence path is invalid." };
  }

  const service = createServiceClient();
  const { data: submission, error: submissionError } = await service
    .from("identity_verification_submissions")
    .select("id,verification_id,user_id,status")
    .eq("id", input.submissionId)
    .eq("verification_id", input.verificationId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (submissionError || !submission) {
    return { ok: false, error: "Identity verification attempt was not found." };
  }
  if (submission.status !== "draft") {
    return { ok: false, error: "This identity verification attempt has already been submitted." };
  }

  const { data: objects, error: storageError } = await service.storage
    .from("identity-verification")
    .list(`${ctx.userId}/${input.submissionId}`, { limit: 20 });
  if (storageError) return { ok: false, error: "Could not verify captured identity images." };

  const present = new Set((objects ?? []).map((item) => item.name));
  for (const required of ["document-front.jpg", "document-back.jpg", "selfie.jpg"]) {
    if (!present.has(required)) {
      return { ok: false, error: "All live document and face captures are required before submission." };
    }
  }

  const now = new Date().toISOString();
  const { error: updateSubmissionError } = await service
    .from("identity_verification_submissions")
    .update({
      document_front_path: input.documentFrontPath,
      document_back_path: input.documentBackPath,
      selfie_path: input.selfiePath,
      status: "submitted",
      submitted_at: now,
      reason: null,
      admin_note: null,
    })
    .eq("id", input.submissionId)
    .eq("user_id", ctx.userId);
  if (updateSubmissionError) {
    return { ok: false, error: "Could not submit identity verification." };
  }

  const { error: updateVerificationError } = await service
    .from("identity_verifications")
    .update({
      latest_submission_id: input.submissionId,
      status: "submitted",
      submitted_at: now,
      reason: null,
      admin_note: null,
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq("id", input.verificationId)
    .eq("user_id", ctx.userId);
  if (updateVerificationError) {
    return { ok: false, error: "Could not finalize identity verification." };
  }

  await service.from("identity_verification_events").insert({
    verification_id: input.verificationId,
    submission_id: input.submissionId,
    user_id: ctx.userId,
    actor_user_id: ctx.userId,
    event_type: "verification_submitted",
    metadata: {},
  });

  revalidatePath("/verify-identity");
  revalidatePath("/dashboard");
  return { ok: true, data: { status: "submitted" } };
}
