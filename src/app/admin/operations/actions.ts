"use server";

import { revalidatePath } from "next/cache";
import { RequireAdminPermission } from "@/lib/auth/guards";
import type { AdminPermission } from "@/lib/admin/permissions";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function bool(formData: FormData, key: string) {
  const value = formData.get(key);
  return value === "true" || value === "on" || value === "1";
}

function uuidOrNull(value: string) {
  return /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

function permissionForCaseType(caseType: string): AdminPermission {
  if (["rights_claim", "fraud_review", "catalog_conflict", "privacy_request"].includes(caseType)) {
    return "admin:compliance";
  }
  if (caseType === "security_review") return "admin:users";
  if (caseType === "tax_compliance") return "admin:finance";
  if (caseType === "email_deliverability") return "admin:emails";
  return "admin:operations";
}

async function requireCasePermission(caseType: string) {
  return RequireAdminPermission(permissionForCaseType(caseType));
}

async function caseTypeForId(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_ops_cases")
    .select("case_type")
    .eq("id", id)
    .maybeSingle();
  if (error || !data?.case_type) return null;
  return data.case_type;
}

function revalidateOps() {
  for (const path of [
    "/admin/operations",
    "/admin/rights",
    "/admin/fraud",
    "/admin/conflicts",
    "/admin/privacy",
    "/admin/security",
    "/admin/email-deliverability",
    "/admin/tax-compliance",
    "/admin/system-health",
    "/admin/feature-flags",
    "/admin/broadcasts",
    "/admin/approvals",
    "/admin/contracts",
    "/admin/work-queue",
    "/admin/distribution/stores",
    "/admin/audit",
  ]) revalidatePath(path);
}

export async function createOpsCaseAction(formData: FormData) {
  const caseType = text(formData, "case_type");
  const ctx = await requireCasePermission(caseType);
  const title = text(formData, "title");
  if (!title) return;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_ops_cases")
    .insert({
      case_type: caseType,
      title,
      description: text(formData, "description") || null,
      status: text(formData, "status") || "open",
      priority: text(formData, "priority") || "normal",
      subject_user_id: uuidOrNull(text(formData, "subject_user_id")),
      release_id: uuidOrNull(text(formData, "release_id")),
      assigned_to: uuidOrNull(text(formData, "assigned_to")),
      due_at: text(formData, "due_at") || null,
      payout_hold: bool(formData, "payout_hold"),
      distribution_hold: bool(formData, "distribution_hold"),
      source: text(formData, "source") || "admin",
      created_by: ctx.userId,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await supabase.from("admin_ops_case_events").insert({
    case_id: data.id,
    event_type: "created",
    message: "Case opened.",
    actor_user_id: ctx.userId,
  });
  revalidateOps();
}

export async function updateOpsCaseAction(formData: FormData) {
  const id = uuidOrNull(text(formData, "id"));
  if (!id) return;
  const caseType = await caseTypeForId(id);
  if (!caseType) return;
  const ctx = await requireCasePermission(caseType);
  const status = text(formData, "status");
  const now = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_ops_cases")
    .update({
      status,
      priority: text(formData, "priority") || "normal",
      assigned_to: uuidOrNull(text(formData, "assigned_to")),
      due_at: text(formData, "due_at") || null,
      payout_hold: bool(formData, "payout_hold"),
      distribution_hold: bool(formData, "distribution_hold"),
      resolved_at: ["resolved", "closed"].includes(status) ? now : null,
      updated_at: now,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await supabase.from("admin_ops_case_events").insert({
    case_id: id,
    event_type: "status_update",
    message: `Case updated to ${status || "open"}.`,
    metadata: { priority: text(formData, "priority") || "normal" },
    actor_user_id: ctx.userId,
  });
  revalidateOps();
}

export async function addOpsCaseNoteAction(formData: FormData) {
  const caseId = uuidOrNull(text(formData, "case_id"));
  const message = text(formData, "message");
  if (!caseId || !message) return;
  const caseType = await caseTypeForId(caseId);
  if (!caseType) return;
  const ctx = await requireCasePermission(caseType);
  const supabase = await createClient();
  const { error } = await supabase.from("admin_ops_case_events").insert({
    case_id: caseId,
    event_type: text(formData, "event_type") || "note",
    message,
    actor_user_id: ctx.userId,
  });
  if (error) throw new Error(error.message);
  await supabase.from("admin_ops_cases").update({ updated_at: new Date().toISOString() }).eq("id", caseId);
  revalidateOps();
}

export async function addOpsEvidenceAction(formData: FormData) {
  const caseId = uuidOrNull(text(formData, "case_id"));
  const label = text(formData, "label");
  if (!caseId || !label) return;
  const caseType = await caseTypeForId(caseId);
  if (!caseType) return;
  const ctx = await requireCasePermission(caseType);
  const supabase = await createClient();
  const { error } = await supabase.from("admin_ops_case_evidence").insert({
    case_id: caseId,
    label,
    evidence_url: text(formData, "evidence_url") || null,
    storage_path: text(formData, "storage_path") || null,
    notes: text(formData, "notes") || null,
    added_by: ctx.userId,
  });
  if (error) throw new Error(error.message);
  revalidateOps();
}

export async function toggleFeatureFlagAction(formData: FormData) {
  const ctx = await RequireAdminPermission("admin:settings");
  const key = text(formData, "key");
  if (!key) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_feature_flags")
    .update({
      enabled: bool(formData, "enabled"),
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("key", key);
  if (error) throw new Error(error.message);
  revalidateOps();
}

export async function createAnnouncementAction(formData: FormData) {
  const ctx = await RequireAdminPermission("admin:notifications");
  const title = text(formData, "title");
  const body = text(formData, "body");
  if (!title || !body) return;
  const supabase = await createClient();
  const { error } = await supabase.from("admin_announcements").insert({
    title,
    body,
    audience: text(formData, "audience") || "all",
    target_user_id: uuidOrNull(text(formData, "target_user_id")),
    country_code: text(formData, "country_code") || null,
    severity: text(formData, "severity") || "info",
    active: true,
    starts_at: text(formData, "starts_at") || new Date().toISOString(),
    ends_at: text(formData, "ends_at") || null,
    created_by: ctx.userId,
  });
  if (error) throw new Error(error.message);
  revalidateOps();
}

export async function setAnnouncementActiveAction(formData: FormData) {
  await RequireAdminPermission("admin:notifications");
  const id = uuidOrNull(text(formData, "id"));
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_announcements")
    .update({ active: bool(formData, "active"), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateOps();
}

export async function createHighRiskRequestAction(formData: FormData) {
  await RequireAdminPermission("admin:operations");
  const actionType = text(formData, "action_type");
  const reason = text(formData, "reason");
  if (!actionType || !reason) return;
  let payload: Record<string, unknown> = {};
  try {
    const raw = text(formData, "payload");
    if (raw) payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("Payload must be valid JSON.");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_admin_high_risk_request", {
    p_action_type: actionType,
    p_target_type: text(formData, "target_type") || null,
    p_target_id: text(formData, "target_id") || null,
    p_payload: payload,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  revalidateOps();
}

export async function reviewHighRiskRequestAction(formData: FormData) {
  await RequireAdminPermission("admin:operations");
  const id = uuidOrNull(text(formData, "id"));
  const status = text(formData, "status");
  if (!id || !["approved", "rejected", "cancelled"].includes(status)) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_admin_high_risk_request", {
    p_id: id,
    p_status: status,
    p_execution_note: text(formData, "execution_note") || null,
  });
  if (error) throw new Error(error.message);
  revalidateOps();
}

export async function addEmailSuppressionAction(formData: FormData) {
  const ctx = await RequireAdminPermission("admin:emails");
  const email = text(formData, "email").toLowerCase();
  const reason = text(formData, "reason");
  if (!email || !reason) return;
  const supabase = await createClient();
  const { error } = await supabase.from("email_suppressions").upsert({
    email,
    reason,
    source: "admin",
    active: true,
    created_by: ctx.userId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidateOps();
}

export async function removeEmailSuppressionAction(formData: FormData) {
  await RequireAdminPermission("admin:emails");
  const email = text(formData, "email").toLowerCase();
  if (!email) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("email_suppressions")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("email", email);
  if (error) throw new Error(error.message);
  revalidateOps();
}

export async function updateTaxComplianceAction(formData: FormData) {
  const ctx = await RequireAdminPermission("admin:finance");
  const userId = uuidOrNull(text(formData, "user_id"));
  if (!userId) return;
  const withholding = Math.max(0, Math.min(10000, Number(text(formData, "withholding_bps") || "0")));
  const supabase = await createClient();
  const { error } = await supabase.from("tax_compliance_profiles").upsert({
    user_id: userId,
    status: text(formData, "status") || "not_required",
    country_code: text(formData, "country_code") || null,
    withholding_bps: Math.round(withholding),
    hold_payouts: bool(formData, "hold_payouts"),
    notes: text(formData, "notes") || null,
    reviewed_by: ctx.userId,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidateOps();
}

export async function updateStoreCapabilityAction(formData: FormData) {
  const ctx = await RequireAdminPermission("admin:distribution");
  const storeKey = text(formData, "store_key");
  if (!storeKey) return;
  let restrictions: Record<string, unknown> = {};
  try {
    const raw = text(formData, "restrictions");
    if (raw) restrictions = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("Restrictions must be valid JSON.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("distribution_store_capabilities")
    .update({
      operational_status: text(formData, "operational_status") || "unknown",
      audio_supported: formData.has("audio_supported") ? bool(formData, "audio_supported") : null,
      video_supported: formData.has("video_supported") ? bool(formData, "video_supported") : null,
      atmos_supported: formData.has("atmos_supported") ? bool(formData, "atmos_supported") : null,
      restrictions,
      notes: text(formData, "notes") || null,
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("store_key", storeKey);
  if (error) throw new Error(error.message);
  revalidateOps();
}

export async function createPolicyVersionAction(formData: FormData) {
  const ctx = await RequireAdminPermission("admin:compliance");
  const policyKey = text(formData, "policy_key");
  const version = text(formData, "version");
  const title = text(formData, "title");
  const bodyHtml = text(formData, "body_html");
  if (!policyKey || !version || !title || !bodyHtml) return;
  const supabase = await createClient();
  const { error } = await supabase.from("admin_policy_versions").insert({
    policy_key: policyKey,
    version,
    title,
    body_html: bodyHtml,
    status: "draft",
    effective_at: text(formData, "effective_at") || null,
    requires_reacceptance: bool(formData, "requires_reacceptance"),
    created_by: ctx.userId,
  });
  if (error) throw new Error(error.message);
  revalidateOps();
}

export async function updatePolicyVersionStatusAction(formData: FormData) {
  await RequireAdminPermission("admin:compliance");
  const id = uuidOrNull(text(formData, "id"));
  const status = text(formData, "status");
  if (!id || !["draft", "active", "retired"].includes(status)) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_policy_versions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateOps();
}

export async function revokeUserOtpSessionsAction(formData: FormData) {
  await RequireAdminPermission("admin:users");
  const userId = uuidOrNull(text(formData, "user_id"));
  if (!userId) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_revoke_user_otp_sessions", {
    p_user_id: userId,
    p_reason: text(formData, "reason") || null,
  });
  if (error) throw new Error(error.message);
  revalidateOps();
}
