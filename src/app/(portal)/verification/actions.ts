"use server";

import { revalidatePath } from "next/cache";
import { RequireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type {
  IdentityDocumentType,
  IdentityEvidenceType,
  IdentityVerification,
} from "@/lib/verification/types";

type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function safeMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const value = String((error as { message?: unknown }).message ?? "").trim();
    if (value) return value.slice(0, 500);
  }
  return fallback;
}

async function requireVerificationOwner() {
  const ctx = await RequireRole(["artist", "label"]);
  const accountType = ctx.roles.includes("label") ? "label" : "artist";
  return { ...ctx, accountType } as const;
}

export async function saveVerificationDetailsAction(input: {
  countryCode: string;
  legalFullName: string;
  dateOfBirth: string;
  documentType: IdentityDocumentType;
  consent: boolean;
}): Promise<ActionResult<IdentityVerification>> {
  await requireVerificationOwner();
  const countryCode = input.countryCode.trim().toUpperCase();
  const legalFullName = input.legalFullName.trim();

  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return { ok: false, error: "Select a valid country." };
  }
  if (legalFullName.length < 2 || legalFullName.length > 200) {
    return { ok: false, error: "Enter your full legal name exactly as it appears on your ID." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateOfBirth)) {
    return { ok: false, error: "Enter a valid date of birth." };
  }
  if (!["nin", "national_id", "drivers_license", "passport"].includes(input.documentType)) {
    return { ok: false, error: "Select a valid identity document." };
  }
  if (!input.consent) {
    return { ok: false, error: "You must consent to identity verification before continuing." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_identity_verification_details", {
      p_country_code: countryCode,
      p_legal_full_name: legalFullName,
      p_date_of_birth: input.dateOfBirth,
      p_document_type: input.documentType,
      p_consent: true,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/verification");
    return { ok: true, data: data as IdentityVerification };
  } catch (error) {
    return { ok: false, error: safeMessage(error, "Could not save verification details.") };
  }
}

export async function recordVerificationEvidenceAction(input: {
  verificationId: string;
  evidenceType: IdentityEvidenceType;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  captureMetadata?: Record<string, unknown>;
}): Promise<ActionResult> {
  const ctx = await requireVerificationOwner();

  if (!/^[0-9a-f-]{36}$/i.test(input.verificationId)) {
    return { ok: false, error: "Invalid verification session." };
  }
  if (!["document_front", "document_back", "selfie"].includes(input.evidenceType)) {
    return { ok: false, error: "Invalid capture type." };
  }
  const expectedPrefix = `${ctx.userId}/${input.verificationId}/`;
  if (!input.storagePath.startsWith(expectedPrefix)) {
    return { ok: false, error: "Invalid verification storage path." };
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(input.mimeType)) {
    return { ok: false, error: "Unsupported camera image format." };
  }
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 1 || input.sizeBytes > 10 * 1024 * 1024) {
    return { ok: false, error: "Verification image must be under 10MB." };
  }

  const capture = input.captureMetadata ?? {};
  const safeCapture = {
    source: "live_camera",
    captured_at:
      typeof capture.captured_at === "string" ? capture.captured_at.slice(0, 80) : new Date().toISOString(),
    width: Number.isFinite(Number(capture.width)) ? Number(capture.width) : null,
    height: Number.isFinite(Number(capture.height)) ? Number(capture.height) : null,
    facing_mode:
      typeof capture.facing_mode === "string" ? capture.facing_mode.slice(0, 30) : null,
    user_agent:
      typeof capture.user_agent === "string" ? capture.user_agent.slice(0, 300) : null,
  };

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_identity_verification_evidence", {
      p_verification_id: input.verificationId,
      p_evidence_type: input.evidenceType,
      p_storage_path: input.storagePath,
      p_mime_type: input.mimeType,
      p_size_bytes: input.sizeBytes,
      p_capture_metadata: safeCapture,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/verification");
    return { ok: true, data: true };
  } catch (error) {
    return { ok: false, error: safeMessage(error, "Could not save camera capture.") };
  }
}

export async function submitVerificationAction(
  verificationId: string
): Promise<ActionResult<IdentityVerification>> {
  await requireVerificationOwner();

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("submit_identity_verification", {
      p_verification_id: verificationId,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/verification");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/profile");
    return { ok: true, data: data as IdentityVerification };
  } catch (error) {
    return { ok: false, error: safeMessage(error, "Could not submit identity verification.") };
  }
}
