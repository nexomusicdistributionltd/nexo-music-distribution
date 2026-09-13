"use server";

import { revalidatePath } from "next/cache";
import { RequireAdmin, RequireAdminPermission, RequireSuperAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  QC_CHECKLIST_KEYS,
  validateQcDecision,
  type QcChecklist,
  type QcDecision,
  type QcPriority,
} from "@/lib/admin/qc";
import { canTransitionPayout, type PayoutStatus } from "@/lib/finance/money";
import type { AppRole } from "@/lib/auth/types";
import { isAllowedAdminSettingKey } from "@/lib/admin/settings";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function revalidateAdmin(paths: string[] = []) {
  revalidatePath("/admin");
  for (const p of paths) revalidatePath(p);
}

export async function claimQcItem(itemId: string): Promise<ActionResult> {
  await RequireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_qc_item", { p_item_id: itemId });
  if (error) return { ok: false, error: error.message };
  revalidateAdmin(["/admin/qc", "/admin/releases"]);
  return { ok: true, data };
}

export async function releaseQcClaim(itemId: string): Promise<ActionResult> {
  await RequireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("release_qc_item", { p_item_id: itemId });
  if (error) return { ok: false, error: error.message };
  revalidateAdmin(["/admin/qc"]);
  return { ok: true, data };
}

export async function setQcPriority(
  itemId: string,
  priority: QcPriority
): Promise<ActionResult> {
  await RequireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_qc_item_priority", {
    p_item_id: itemId,
    p_priority: priority,
  });
  if (error) return { ok: false, error: error.message };
  revalidateAdmin(["/admin/qc"]);
  return { ok: true, data: true };
}

export async function performQcDecisionAction(input: {
  releaseId: string;
  decision: QcDecision;
  checklist: QcChecklist;
  artistVisibleReason?: string;
  internalNote?: string;
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:qc");
  const check = validateQcDecision({
    decision: input.decision,
    artistVisibleReason: input.artistVisibleReason,
    checklist: input.checklist,
  });
  if (!check.ok) return { ok: false, error: check.error };

  const checklist: QcChecklist = {};
  for (const k of QC_CHECKLIST_KEYS) {
    checklist[k] = input.checklist[k] === true;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("perform_qc_decision", {
    p_release_id: input.releaseId,
    p_decision: input.decision,
    p_checklist: checklist,
    p_artist_visible_reason: input.artistVisibleReason ?? null,
    p_internal_note: input.internalNote ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateAdmin([
    "/admin/qc",
    "/admin/releases",
    `/admin/releases/${input.releaseId}`,
  ]);
  return { ok: true, data };
}

export async function bulkClaimQc(itemIds: string[]): Promise<ActionResult<{ claimed: number; failed: string[] }>> {
  await RequireAdmin();
  const ids = [...new Set(itemIds)].slice(0, 25);
  const failed: string[] = [];
  let claimed = 0;
  const supabase = await createClient();
  for (const id of ids) {
    const { error } = await supabase.rpc("claim_qc_item", { p_item_id: id });
    if (error) failed.push(id);
    else claimed += 1;
  }
  revalidateAdmin(["/admin/qc"]);
  return { ok: true, data: { claimed, failed } };
}

export async function setAccountStatusAction(input: {
  userId: string;
  status: "active" | "suspended" | "deactivated";
  reason: string;
  restriction?: "none" | "submit_blocked" | "login_restricted" | "read_only";
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:users");
  if (!input.reason.trim()) return { ok: false, error: "Reason required." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_set_account_status", {
    p_target: input.userId,
    p_status: input.status,
    p_reason: input.reason.trim(),
    p_restriction: input.restriction ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateAdmin(["/admin/users", "/admin/artists", "/admin/labels"]);
  return { ok: true, data };
}

export async function setUserRolesAction(input: {
  userId: string;
  roles: AppRole[];
}): Promise<ActionResult> {
  await RequireSuperAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("super_admin_set_roles", {
    p_target: input.userId,
    p_roles: input.roles,
  });
  if (error) return { ok: false, error: error.message };
  revalidateAdmin(["/admin/users"]);
  return { ok: true, data: true };
}

export async function updatePayoutStatusAction(input: {
  payoutId: string;
  status: PayoutStatus;
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:payouts");
  const supabase = await createClient();
  const { data: current, error: readErr } = await supabase
    .from("payouts")
    .select("status")
    .eq("id", input.payoutId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!current) return { ok: false, error: "Payout not found." };

  const gate = canTransitionPayout(current.status as PayoutStatus, input.status);
  if (!gate.ok) return { ok: false, error: gate.reason ?? "Not allowed." };

  const { error } = await supabase.rpc("transition_payout_status", {
    p_payout_id: input.payoutId,
    p_new_status: input.status,
    p_reason: "Admin operations status update",
  });
  if (error) return { ok: false, error: error.message };
  revalidateAdmin(["/admin/payouts", "/admin/finance"]);
  return { ok: true, data: true };
}

export async function updateTicketAction(input: {
  ticketId: string;
  status?: string;
  priority?: string;
  reply?: string;
  internal?: boolean;
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:support");
  const ctx = await RequireAdmin();
  const supabase = await createClient();
  const allowedStatuses = new Set(["open", "pending", "awaiting_user", "resolved", "closed"]);
  const allowedPriorities = new Set(["low", "normal", "high", "urgent"]);
  if (input.status && !allowedStatuses.has(input.status)) {
    return { ok: false, error: "Invalid ticket status." };
  }
  if (input.priority && !allowedPriorities.has(input.priority)) {
    return { ok: false, error: "Invalid ticket priority." };
  }

  if (input.status || input.priority) {
    const patch: Record<string, string> = {};
    if (input.status) patch.status = input.status;
    if (input.priority) patch.priority = input.priority;
    const { error } = await supabase
      .from("support_tickets")
      .update(patch)
      .eq("id", input.ticketId);
    if (error) return { ok: false, error: error.message };
  }

  if (input.reply?.trim()) {
    const { error } = await supabase.from("support_messages").insert({
      ticket_id: input.ticketId,
      author_user_id: ctx.userId,
      body: input.reply.trim(),
      is_internal: input.internal === true,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidateAdmin(["/admin/support"]);
  return { ok: true, data: true };
}

export async function updateContactStatusAction(input: {
  id: string;
  status: string;
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:contact");
  const allowed = new Set(["new", "triaged", "replied", "closed", "spam"]);
  if (!allowed.has(input.status)) return { ok: false, error: "Invalid status." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("contact_messages")
    .update({ status: input.status })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidateAdmin(["/admin/contact"]);
  return { ok: true, data: true };
}

export async function updateComplianceCaseAction(input: {
  id: string;
  status?: string;
  summary?: string;
}): Promise<ActionResult> {
  await RequireAdminPermission("admin:compliance");
  const allowed = new Set(["open", "investigating", "resolved", "dismissed", "escalated"]);
  if (input.status && !allowed.has(input.status)) return { ok: false, error: "Invalid status." };
  const supabase = await createClient();
  const patch: Record<string, string> = {};
  if (input.status) patch.status = input.status;
  if (input.summary !== undefined) patch.summary = input.summary;
  const { error } = await supabase.from("compliance_cases").update(patch).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidateAdmin(["/admin/compliance"]);
  return { ok: true, data: true };
}

export async function createComplianceCaseAction(input: {
  title: string;
  summary?: string;
  subjectUserId?: string;
  releaseId?: string;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await RequireAdminPermission("admin:compliance");
  if (!input.title.trim()) return { ok: false, error: "Title required." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("compliance_cases")
    .insert({
      title: input.title.trim(),
      summary: input.summary?.trim() || null,
      subject_user_id: input.subjectUserId || null,
      release_id: input.releaseId || null,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidateAdmin(["/admin/compliance"]);
  return { ok: true, data: { id: data.id } };
}

export async function saveAdminSettingAction(input: {
  key: string;
  value: Record<string, unknown>;
}): Promise<ActionResult> {
  const ctx = await RequireAdminPermission("admin:settings");
  const key = input.key.trim().toLowerCase();
  if (!isAllowedAdminSettingKey(key)) {
    return { ok: false, error: "Setting key is not allowlisted." };
  }
  if (/(secret|password|token|service_role|api[_-]?key)/i.test(key)) {
    return { ok: false, error: "Secrets are not allowed in settings." };
  }
  const raw = JSON.stringify(input.value);
  if (/(secret|password|token|service_role|api[_-]?key)/i.test(raw)) {
    return { ok: false, error: "Settings values must not contain secrets." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("admin_settings").upsert({
    key,
    value: input.value,
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  await supabase.from("audit_logs").insert({
    actor_user_id: ctx.userId,
    action: "settings_update",
    entity_type: "admin_setting",
    entity_id: null,
    metadata: { key },
  });
  revalidateAdmin(["/admin/settings"]);
  return { ok: true, data: true };
}

export async function requestReportExportAction(input: {
  reportType: string;
  params?: Record<string, unknown>;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await RequireAdminPermission("admin:reports");
  const allowed = new Set([
    "releases_summary",
    "qc_throughput",
    "users_summary",
    "tickets_summary",
  ]);
  if (!allowed.has(input.reportType)) {
    return { ok: false, error: "Unknown report type." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_exports")
    .insert({
      requested_by: ctx.userId,
      report_type: input.reportType,
      params: input.params ?? {},
      status: "pending",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await supabase.from("audit_logs").insert({
    actor_user_id: ctx.userId,
    action: "report_export",
    entity_type: "report_export",
    entity_id: data.id,
    metadata: { report_type: input.reportType },
  });

  revalidateAdmin(["/admin/reports", "/admin/audit"]);
  return { ok: true, data: { id: data.id } };
}
