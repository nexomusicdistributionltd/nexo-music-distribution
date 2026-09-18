"use server";

import { revalidatePath } from "next/cache";
import { RequireAdministrator } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/admin";
import type { IdentityVerificationStatus } from "@/lib/identity/types";

type ReviewStatus = Extract<
  IdentityVerificationStatus,
  "under_review" | "verified" | "declined" | "additional_info_required"
>;

export async function reviewIdentityVerificationAction(input: {
  verificationId: string;
  submissionId: string;
  status: ReviewStatus;
  reason?: string;
  adminNote?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await RequireAdministrator();
  const reason = input.reason?.trim() || null;
  const adminNote = input.adminNote?.trim() || null;

  if (
    (input.status === "declined" || input.status === "additional_info_required") &&
    !reason
  ) {
    return { ok: false, error: "A reason is required for this review decision." };
  }

  const service = createServiceClient();
  const { data: verification, error } = await service
    .from("identity_verifications")
    .select("id,user_id,legal_name,status,latest_submission_id")
    .eq("id", input.verificationId)
    .maybeSingle();

  if (error || !verification) {
    return { ok: false, error: "Verification record was not found." };
  }
  if (verification.latest_submission_id !== input.submissionId) {
    return { ok: false, error: "Review the latest verification submission." };
  }

  const now = new Date().toISOString();
  const update = {
    status: input.status,
    reason,
    admin_note: adminNote,
    reviewed_by: ctx.userId,
    reviewed_at: now,
    verified_at: input.status === "verified" ? now : null,
  };

  const [{ error: verificationError }, { error: submissionError }] = await Promise.all([
    service
      .from("identity_verifications")
      .update(update)
      .eq("id", input.verificationId),
    service
      .from("identity_verification_submissions")
      .update(update)
      .eq("id", input.submissionId)
      .eq("verification_id", input.verificationId),
  ]);

  if (verificationError || submissionError) {
    return { ok: false, error: "Could not save the verification review." };
  }

  if (input.status === "verified") {
    await service
      .from("profiles")
      .update({ full_name: verification.legal_name })
      .eq("id", verification.user_id);
  }

  await service.from("identity_verification_events").insert({
    verification_id: input.verificationId,
    submission_id: input.submissionId,
    user_id: verification.user_id,
    actor_user_id: ctx.userId,
    event_type: `verification_${input.status}`,
    metadata: reason ? { reason } : {},
  });

  revalidatePath("/admin/verifications");
  revalidatePath(`/admin/verifications/${input.verificationId}`);
  revalidatePath("/dashboard");
  revalidatePath("/verify-identity");
  return { ok: true };
}
