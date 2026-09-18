"use server";

import { revalidatePath } from "next/cache";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { publicErrorMessage } from "@/lib/http/safe-error";

export type SplitShareReviewKind = "payee" | "split" | "assignment" | "recoupment";
export type SplitShareDecision = "approve" | "reject" | "close";

export async function reviewSplitShareItemAction(input: {
  kind: SplitShareReviewKind;
  id: string;
  decision: SplitShareDecision;
  note?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await RequireAdminPermission("admin:splitshare");
  const validKinds = new Set<SplitShareReviewKind>(["payee", "split", "assignment", "recoupment"]);
  const validDecisions = new Set<SplitShareDecision>(["approve", "reject", "close"]);
  if (!validKinds.has(input.kind) || !validDecisions.has(input.decision)) {
    return { ok: false, error: "Invalid SplitShare review action." };
  }
  if (!/^[0-9a-f-]{36}$/i.test(input.id)) return { ok: false, error: "Invalid record id." };

  const note = (input.note ?? "").trim().slice(0, 2000) || null;
  if (input.decision === "reject" && !note) {
    return { ok: false, error: "Add a reason before rejecting this submission." };
  }
  const supabase = await createClient();
  const reviewedAt = new Date().toISOString();

  if (input.kind === "payee") {
    if (input.decision === "close") return { ok: false, error: "Payees cannot be closed." };
    const { data: payee, error: readError } = await supabase
      .from("portal_payees")
      .select("id, email")
      .eq("id", input.id)
      .maybeSingle();
    if (readError) return { ok: false, error: publicErrorMessage(readError.message) };
    if (!payee) return { ok: false, error: "Payee not found." };

    let linkedUserId: string | null = null;
    if (input.decision === "approve" && payee.email) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .ilike("email", payee.email)
        .maybeSingle();
      linkedUserId = profile?.id ?? null;
    }

    const { error } = await supabase
      .from("portal_payees")
      .update({
        status: input.decision === "approve" ? "approved" : "rejected",
        admin_note: note,
        reviewed_by: ctx.userId,
        reviewed_at: reviewedAt,
        linked_user_id: input.decision === "approve" ? linkedUserId : null,
      })
      .eq("id", input.id);
    if (error) return { ok: false, error: publicErrorMessage(error.message) };
  }

  if (input.kind === "split") {
    if (input.decision === "close") return { ok: false, error: "Split rules cannot be closed." };
    if (input.decision === "approve") {
      const { data: shares, error: shareError } = await supabase
        .from("royalty_split_shares")
        .select("share_bps, payee_id")
        .eq("rule_id", input.id);
      if (shareError) return { ok: false, error: publicErrorMessage(shareError.message) };
      const total = (shares ?? []).reduce((sum, share) => sum + Number(share.share_bps ?? 0), 0);
      if (total !== 10000 || (shares ?? []).length === 0) {
        return { ok: false, error: "Split shares must total exactly 100% before approval." };
      }
      const payeeIds = [...new Set((shares ?? []).map((share) => share.payee_id).filter(Boolean))] as string[];
      if (payeeIds.length !== (shares ?? []).length) {
        return { ok: false, error: "Every split share must reference an approved payee." };
      }
      const { data: payees, error: payeeError } = await supabase
        .from("portal_payees")
        .select("id, status")
        .in("id", payeeIds);
      if (payeeError) return { ok: false, error: publicErrorMessage(payeeError.message) };
      if ((payees ?? []).some((payee) => payee.status !== "approved") || (payees ?? []).length !== payeeIds.length) {
        return { ok: false, error: "All split payees must be approved before the rule can be approved." };
      }
    }

    const { error } = await supabase
      .from("royalty_split_rules")
      .update({
        review_status: input.decision === "approve" ? "approved" : "rejected",
        is_active: input.decision === "approve",
        admin_note: note,
        reviewed_by: ctx.userId,
        reviewed_at: reviewedAt,
      })
      .eq("id", input.id);
    if (error) return { ok: false, error: publicErrorMessage(error.message) };
  }

  if (input.kind === "assignment") {
    if (input.decision === "close") return { ok: false, error: "Assignments cannot be closed." };
    if (input.decision === "approve") {
      const { data: assignment } = await supabase
        .from("split_track_assignments")
        .select("split_rule_id")
        .eq("id", input.id)
        .maybeSingle();
      if (!assignment) return { ok: false, error: "Assignment not found." };
      const { data: rule } = await supabase
        .from("royalty_split_rules")
        .select("id")
        .eq("id", assignment.split_rule_id)
        .eq("review_status", "approved")
        .eq("is_active", true)
        .maybeSingle();
      if (!rule) return { ok: false, error: "The split rule must be approved and active first." };
    }

    const { error } = await supabase
      .from("split_track_assignments")
      .update({
        status: input.decision === "approve" ? "approved" : "rejected",
        admin_note: note,
        reviewed_by: ctx.userId,
        reviewed_at: reviewedAt,
        updated_at: reviewedAt,
      })
      .eq("id", input.id);
    if (error) return { ok: false, error: publicErrorMessage(error.message) };
  }

  if (input.kind === "recoupment") {
    if (input.decision === "approve") {
      const { data: recoupment } = await supabase
        .from("portal_recoupments")
        .select("payee_id")
        .eq("id", input.id)
        .maybeSingle();
      if (!recoupment) return { ok: false, error: "Recoupment not found." };
      const { data: payee } = await supabase
        .from("portal_payees")
        .select("id")
        .eq("id", recoupment.payee_id)
        .eq("status", "approved")
        .maybeSingle();
      if (!payee) return { ok: false, error: "The recoupment payee must be approved first." };
    }

    const status =
      input.decision === "approve" ? "approved" :
      input.decision === "reject" ? "rejected" :
      "closed";

    const { error } = await supabase
      .from("portal_recoupments")
      .update({
        status,
        admin_note: note,
        reviewed_by: ctx.userId,
        reviewed_at: reviewedAt,
      })
      .eq("id", input.id);
    if (error) return { ok: false, error: publicErrorMessage(error.message) };
  }

  for (const path of [
    "/admin/splitshare",
    "/earnings/splits",
    "/splitshare/payees",
    "/splitshare/assignments",
    "/splitshare/recoupments",
  ]) {
    revalidatePath(path);
  }

  return { ok: true };
}
