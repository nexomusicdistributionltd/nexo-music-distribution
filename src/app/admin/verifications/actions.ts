"use server";

import { revalidatePath } from "next/cache";
import { RequireAdministrator } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import type { IdentityVerificationStatus } from "@/lib/verification/types";

type Result = { ok: true } | { ok: false; error: string };

export async function reviewVerificationAction(input: {
  verificationId: string;
  status: Extract<
    IdentityVerificationStatus,
    "under_review" | "verified" | "declined" | "additional_information_required"
  >;
  reason?: string;
}): Promise<Result> {
  await RequireAdministrator();

  if (
    !["under_review", "verified", "declined", "additional_information_required"].includes(
      input.status
    )
  ) {
    return { ok: false, error: "Invalid verification decision." };
  }
  const reason = input.reason?.trim() || null;
  if (
    (input.status === "declined" || input.status === "additional_information_required") &&
    !reason
  ) {
    return { ok: false, error: "A reason is required for this decision." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_identity_verification", {
    p_verification_id: input.verificationId,
    p_status: input.status,
    p_reason: reason,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/verifications");
  revalidatePath(`/admin/verifications/${input.verificationId}`);
  revalidatePath("/admin/artists");
  revalidatePath("/admin/labels");
  return { ok: true };
}

export async function saveVerificationRiskNotesAction(input: {
  verificationId: string;
  riskNotes: string;
}): Promise<Result> {
  const ctx = await RequireAdministrator();
  const notes = input.riskNotes.trim().slice(0, 8000);
  const service = createServiceClient();

  const { data: verification, error: readError } = await service
    .from("identity_verifications")
    .select("id")
    .eq("id", input.verificationId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!verification) return { ok: false, error: "Verification not found." };

  const { error } = await service
    .from("identity_verifications")
    .update({ risk_notes: notes || null, updated_at: new Date().toISOString() })
    .eq("id", input.verificationId);
  if (error) return { ok: false, error: error.message };

  await service.from("identity_verification_events").insert({
    verification_id: input.verificationId,
    actor_user_id: ctx.userId,
    event_type: "risk_notes_updated",
    details: { has_notes: Boolean(notes) },
  });

  revalidatePath(`/admin/verifications/${input.verificationId}`);
  return { ok: true };
}
