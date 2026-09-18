"use server";

import { revalidatePath } from "next/cache";
import { RequireAdministrator } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
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
  await RequireAdministrator();

  const reason = input.reason?.trim() || null;
  const adminNote = input.adminNote?.trim() || null;

  if (
    (input.status === "declined" || input.status === "additional_info_required") &&
    !reason
  ) {
    return { ok: false, error: "A reason is required for this review decision." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_identity_verification_admin", {
    p_verification_id: input.verificationId,
    p_submission_id: input.submissionId,
    p_status: input.status,
    p_reason: reason,
    p_admin_note: adminNote,
  });

  if (error) {
    const message =
      error.code === "42501"
        ? "Administrator permission required."
        : error.message || "Could not save the verification review.";
    return { ok: false, error: message };
  }

  revalidatePath("/admin/verifications");
  revalidatePath(`/admin/verifications/${input.verificationId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  revalidatePath("/verify-identity");

  return { ok: true };
}
