"use server";

import { revalidatePath } from "next/cache";
import { RequireAdministrator } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
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

  if (input.status !== "under_review") {
    try {
      const service = createServiceClient();
      const { data: verification } = await service
        .from("identity_verifications")
        .select("user_id, legal_name")
        .eq("id", input.verificationId)
        .maybeSingle();
      if (verification?.user_id) {
        const { data: profile } = await service
          .from("profiles")
          .select("email, full_name, display_name")
          .eq("id", verification.user_id)
          .maybeSingle();
        const key =
          input.status === "verified"
            ? "IDENTITY_VERIFICATION_APPROVED"
            : input.status === "declined"
              ? "IDENTITY_VERIFICATION_DECLINED"
              : "IDENTITY_VERIFICATION_INFO_REQUIRED";
        const { enqueueTransactionalEmail } = await import("@/lib/email/hooks");
        await enqueueTransactionalEmail({
          supabase: service,
          templateKey: key,
          eventType: "identity.verification",
          to: profile?.email,
          recipientUserId: verification.user_id,
          relatedEntityType: "identity_verification",
          relatedEntityId: input.verificationId,
          idempotencyKey: `IDENTITY_REVIEW:${input.submissionId}:${input.status}`,
          createdBy: ctx.userId,
          payload: {
            FIRST_NAME: profile?.display_name || profile?.full_name || verification.legal_name,
            REASON: reason || "",
            CTA_URL:
              input.status === "verified"
                ? "https://nexomusicdistribution.com/distribution-agreement"
                : "https://nexomusicdistribution.com/verify-identity",
            CTA_LABEL:
              input.status === "verified"
                ? "Review and sign agreement"
                : "Open identity verification",
          },
        });
      }
    } catch {
      // The review decision remains authoritative if email is temporarily unavailable.
    }
  }

  revalidatePath("/admin/verifications");
  revalidatePath(`/admin/verifications/${input.verificationId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  revalidatePath("/verify-identity");

  return { ok: true };
}
