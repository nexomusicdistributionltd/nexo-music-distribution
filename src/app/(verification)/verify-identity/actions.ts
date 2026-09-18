"use server";

import { createHash } from "node:crypto";
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
  const ctx = await RequireRole(["artist", "label"], { allowUnverifiedIdentity: true });
  const countryCode = input.countryCode.trim().toUpperCase();
  const legalName = input.legalName.trim();
  const isArtist = ctx.roles.includes("artist");
  const isLabel = ctx.roles.includes("label");
  if (isArtist === isLabel) {
    return { ok: false, error: "Identity verification requires one artist or label account type." };
  }
  const accountType = isLabel ? "label" : "artist";

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
        account_type: accountType,
        country_code: countryCode,
        legal_name: legalName,
        legal_full_name: legalName,
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
        account_type: accountType,
        country_code: countryCode,
        legal_name: legalName,
        legal_full_name: legalName,
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

  if (!verificationId) {
    return { ok: false, error: "Could not resolve identity verification." };
  }

  const resolvedVerificationId = verificationId;

  const { data: submission, error: submissionError } = await service
    .from("identity_verification_submissions")
    .insert({
      verification_id: resolvedVerificationId,
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
    .eq("id", resolvedVerificationId)
    .eq("user_id", ctx.userId);

  await service.from("identity_verification_events").insert({
    verification_id: resolvedVerificationId,
    submission_id: submission.id,
    user_id: ctx.userId,
    actor_user_id: ctx.userId,
    event_type: "verification_started",
    metadata: { document_type: input.documentType, country_code: countryCode },
  });

  return { ok: true, data: { verificationId: resolvedVerificationId, submissionId: submission.id } };
}

async function hashStoredCapture(
  service: ReturnType<typeof createServiceClient>,
  path: string
): Promise<{ sha256: string; size: number; contentType: string }> {
  const { data, error } = await service.storage
    .from("identity-verification")
    .download(path);
  if (error || !data) {
    throw new Error("Could not read captured identity evidence.");
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length < 1024 || bytes.length > 10 * 1024 * 1024) {
    throw new Error("Captured identity evidence has an invalid file size.");
  }
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    size: bytes.length,
    contentType: data.type || "image/jpeg",
  };
}

export async function submitIdentityVerificationAction(input: {
  verificationId: string;
  submissionId: string;
  documentFrontPath: string;
  documentBackPath: string;
  selfiePath: string;
}): Promise<ActionResult<{ status: "submitted" }>> {
  const ctx = await RequireRole(["artist", "label"], { allowUnverifiedIdentity: true });
  const expectedPrefix = `${ctx.userId}/${input.submissionId}/`;
  const expectedPaths = {
    documentFrontPath: `${expectedPrefix}document-front.jpg`,
    documentBackPath: `${expectedPrefix}document-back.jpg`,
    selfiePath: `${expectedPrefix}selfie.jpg`,
  };

  if (
    input.documentFrontPath !== expectedPaths.documentFrontPath ||
    input.documentBackPath !== expectedPaths.documentBackPath ||
    input.selfiePath !== expectedPaths.selfiePath
  ) {
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

  let front: { sha256: string; size: number; contentType: string };
  let back: { sha256: string; size: number; contentType: string };
  let selfie: { sha256: string; size: number; contentType: string };
  try {
    [front, back, selfie] = await Promise.all([
      hashStoredCapture(service, input.documentFrontPath),
      hashStoredCapture(service, input.documentBackPath),
      hashStoredCapture(service, input.selfiePath),
    ]);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not validate captured identity evidence.",
    };
  }

  const riskSignals: Array<{
    signal_type: string;
    severity: "medium" | "high";
    metadata: Record<string, unknown>;
  }> = [];

  if (front.sha256 === back.sha256) {
    riskSignals.push({
      signal_type: "same_document_image_reused",
      severity: "high",
      metadata: { captures: ["document-front", "document-back"] },
    });
  }
  if (selfie.sha256 === front.sha256 || selfie.sha256 === back.sha256) {
    riskSignals.push({
      signal_type: "selfie_matches_document_capture",
      severity: "high",
      metadata: {},
    });
  }

  const { data: duplicateRows } = await service
    .from("identity_verification_submissions")
    .select("id,user_id,document_front_sha256,document_back_sha256,selfie_sha256")
    .neq("user_id", ctx.userId)
    .or(
      `document_front_sha256.eq.${front.sha256},document_back_sha256.eq.${back.sha256},selfie_sha256.eq.${selfie.sha256}`
    )
    .limit(25);

  const duplicates = duplicateRows ?? [];
  const duplicateFront = duplicates.filter((row) => row.document_front_sha256 === front.sha256);
  const duplicateBack = duplicates.filter((row) => row.document_back_sha256 === back.sha256);
  const duplicateSelfie = duplicates.filter((row) => row.selfie_sha256 === selfie.sha256);

  if (duplicateFront.length > 0) {
    riskSignals.push({
      signal_type: "document_front_seen_on_other_account",
      severity: "high",
      metadata: { match_count: duplicateFront.length },
    });
  }
  if (duplicateBack.length > 0) {
    riskSignals.push({
      signal_type: "document_back_seen_on_other_account",
      severity: "high",
      metadata: { match_count: duplicateBack.length },
    });
  }
  if (duplicateSelfie.length > 0) {
    riskSignals.push({
      signal_type: "selfie_seen_on_other_account",
      severity: "high",
      metadata: { match_count: duplicateSelfie.length },
    });
  }

  const now = new Date().toISOString();
  const { error: updateSubmissionError } = await service
    .from("identity_verification_submissions")
    .update({
      document_front_path: input.documentFrontPath,
      document_back_path: input.documentBackPath,
      selfie_path: input.selfiePath,
      document_front_sha256: front.sha256,
      document_back_sha256: back.sha256,
      selfie_sha256: selfie.sha256,
      capture_metadata: {
        source: "live_camera",
        server_validated_at: now,
        document_front: { size: front.size, content_type: front.contentType },
        document_back: { size: back.size, content_type: back.contentType },
        selfie: { size: selfie.size, content_type: selfie.contentType },
      },
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

  if (riskSignals.length > 0) {
    await service.from("identity_verification_risk_signals").upsert(
      riskSignals.map((signal) => ({
        verification_id: input.verificationId,
        submission_id: input.submissionId,
        signal_type: signal.signal_type,
        severity: signal.severity,
        metadata: signal.metadata,
      })),
      { onConflict: "submission_id,signal_type" }
    );
  }

  await service.from("identity_verification_events").insert({
    verification_id: input.verificationId,
    submission_id: input.submissionId,
    user_id: ctx.userId,
    actor_user_id: ctx.userId,
    event_type: "verification_submitted",
    metadata: {
      capture_source: "live_camera",
      risk_signal_count: riskSignals.length,
    },
  });

  const { data: staffRows } = await service
    .from("user_roles")
    .select("user_id")
    .in("role", ["support", "admin", "super_admin"]);
  const staffIds = [...new Set((staffRows ?? []).map((row) => row.user_id).filter(Boolean))]
    .filter((id) => id !== ctx.userId);
  if (staffIds.length > 0) {
    await service.from("notifications").insert(
      staffIds.map((userId) => ({
        user_id: userId,
        type: "verification_update",
        title: riskSignals.length > 0
          ? "Identity verification submitted — review flags"
          : "Identity verification submitted",
        body: riskSignals.length > 0
          ? "An artist or label submitted live identity evidence with automated review flags."
          : "An artist or label submitted live identity evidence for review.",
        entity_type: "identity_verification",
        entity_id: input.verificationId,
      }))
    );
  }

  revalidatePath("/verify-identity");
  revalidatePath("/dashboard");
  return { ok: true, data: { status: "submitted" } };
}
