"use server";

import { revalidatePath } from "next/cache";
import { RequireAdminPermission } from "@/lib/auth/guards";
import type { AdminPermission } from "@/lib/admin/permissions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { processEmailEvent } from "@/lib/email/outbox";

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

export async function uploadOpsEvidenceAction(formData: FormData) {
  const caseId = uuidOrNull(text(formData, "case_id"));
  const label = text(formData, "label");
  const file = formData.get("file");
  if (!caseId || !label || !(file instanceof File) || file.size <= 0) return;
  if (file.size > 50 * 1024 * 1024) throw new Error("Evidence file must be 50 MB or smaller.");
  const allowed = new Set([
    "application/pdf","image/jpeg","image/png","image/webp","audio/mpeg","audio/wav","text/plain",
  ]);
  if (!allowed.has(file.type)) throw new Error("Unsupported evidence file type.");
  const caseType = await caseTypeForId(caseId);
  if (!caseType) return;
  const ctx = await requireCasePermission(caseType);
  const service = createServiceClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-120) || "evidence";
  const path = `ops-cases/${caseId}/${randomUUID()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await service.storage.from("compliance-evidence").upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);
  const { error: insertError } = await service.from("admin_ops_case_evidence").insert({
    case_id: caseId,
    label,
    storage_path: path,
    mime_type: file.type,
    notes: text(formData, "notes") || null,
    added_by: ctx.userId,
  });
  if (insertError) {
    await service.storage.from("compliance-evidence").remove([path]);
    throw new Error(insertError.message);
  }
  await service.from("admin_ops_case_events").insert({
    case_id: caseId,
    event_type: "evidence_added",
    message: `Evidence uploaded: ${safeName}`,
    actor_user_id: ctx.userId,
  });
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


export async function refreshRiskSignalsAction() {
  await RequireAdminPermission("admin:compliance");
  const supabase = await createClient();
  const { error } = await supabase.rpc("refresh_admin_risk_signals");
  if (error) throw new Error(error.message);
  revalidateOps();
}

export async function updateRiskSignalAction(formData: FormData) {
  const ctx = await RequireAdminPermission("admin:compliance");
  const id = uuidOrNull(text(formData, "id"));
  const status = text(formData, "status");
  if (!id || !["open", "reviewing", "dismissed", "resolved"].includes(status)) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("admin_risk_signals")
    .update({
      status,
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateOps();
}

export async function openFraudCaseFromSignalAction(formData: FormData) {
  const ctx = await RequireAdminPermission("admin:compliance");
  const id = uuidOrNull(text(formData, "id"));
  if (!id) return;
  const supabase = await createClient();
  const { data: signal, error } = await supabase
    .from("admin_risk_signals")
    .select("id,signal_type,severity,subject_user_id,release_id,summary,evidence")
    .eq("id", id)
    .maybeSingle();
  if (error || !signal) throw new Error(error?.message ?? "Risk signal not found.");
  const { error: insertError } = await supabase.from("admin_ops_cases").insert({
    case_type: "fraud_review",
    title: `Risk review: ${signal.signal_type.replaceAll("_", " ")}`,
    description: signal.summary,
    priority: signal.severity === "critical" ? "urgent" : signal.severity === "high" ? "high" : "normal",
    subject_user_id: signal.subject_user_id,
    release_id: signal.release_id,
    source: `risk_signal:${signal.id}`,
    metadata: { risk_signal_id: signal.id, evidence: signal.evidence },
    created_by: ctx.userId,
  });
  if (insertError) throw new Error(insertError.message);
  await supabase
    .from("admin_risk_signals")
    .update({ status: "reviewing", reviewed_by: ctx.userId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidateOps();
}

export async function refreshCatalogConflictsAction() {
  await RequireAdminPermission("admin:compliance");
  const supabase = await createClient();
  const { error } = await supabase.rpc("refresh_catalog_conflict_candidates");
  if (error) throw new Error(error.message);
  revalidateOps();
}

export async function updateCatalogConflictAction(formData: FormData) {
  const ctx = await RequireAdminPermission("admin:compliance");
  const id = uuidOrNull(text(formData, "id"));
  const status = text(formData, "status");
  if (!id || !["open", "reviewing", "evidence_requested", "no_conflict", "resolved"].includes(status)) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("catalog_conflict_candidates")
    .update({
      status,
      resolution_note: text(formData, "resolution_note") || null,
      resolved_by: ["no_conflict", "resolved"].includes(status) ? ctx.userId : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateOps();
}

export async function openConflictCaseAction(formData: FormData) {
  const ctx = await RequireAdminPermission("admin:compliance");
  const id = uuidOrNull(text(formData, "id"));
  if (!id) return;
  const supabase = await createClient();
  const { data: candidate, error } = await supabase
    .from("catalog_conflict_candidates")
    .select("id,conflict_type,identifier,release_ids,owner_user_ids,linked_case_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !candidate) throw new Error(error?.message ?? "Conflict not found.");
  if (candidate.linked_case_id) return;
  const { data: created, error: createError } = await supabase
    .from("admin_ops_cases")
    .insert({
      case_type: "catalog_conflict",
      title: `${candidate.conflict_type.replaceAll("_", " ")}: ${candidate.identifier}`,
      description: "Identifier conflict detected across different Nexo account owners. Review evidence before changing ownership.",
      priority: "high",
      release_id: candidate.release_ids?.[0] ?? null,
      source: `catalog_conflict:${candidate.id}`,
      metadata: {
        candidate_id: candidate.id,
        identifier: candidate.identifier,
        release_ids: candidate.release_ids,
        owner_user_ids: candidate.owner_user_ids,
      },
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (createError) throw new Error(createError.message);
  await supabase
    .from("catalog_conflict_candidates")
    .update({ linked_case_id: created.id, status: "reviewing", updated_at: new Date().toISOString() })
    .eq("id", id);
  revalidateOps();
}

export async function requestOwnershipReassignmentAction(formData: FormData) {
  await RequireAdminPermission("admin:compliance");
  const candidateId = uuidOrNull(text(formData, "candidate_id"));
  const releaseId = uuidOrNull(text(formData, "release_id"));
  const targetOwner = uuidOrNull(text(formData, "target_owner_user_id"));
  const reason = text(formData, "reason");
  if (!releaseId || !targetOwner || !reason) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_admin_high_risk_request", {
    p_action_type: "release_ownership_reassignment",
    p_target_type: "release",
    p_target_id: releaseId,
    p_payload: {
      candidate_id: candidateId,
      release_id: releaseId,
      target_owner_user_id: targetOwner,
    },
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  if (candidateId) {
    await supabase.from("catalog_conflict_candidates").update({ status: "reviewing", updated_at: new Date().toISOString() }).eq("id", candidateId);
  }
  revalidateOps();
}

export async function executeOwnershipReassignmentAction(formData: FormData) {
  await RequireAdminPermission("admin:compliance");
  const id = uuidOrNull(text(formData, "request_id"));
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("execute_release_ownership_reassignment", { p_request_id: id });
  if (error) throw new Error(error.message);
  revalidateOps();
}

function escapeBroadcastHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildBroadcastHtml(title: string, body: string) {
  const paragraphs = body
    .split(/\n\n+/)
    .map((part) => `<p style="margin:0 0 16px">${escapeBroadcastHtml(part).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#111"><div style="max-width:640px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border:1px solid #e5e5e5;border-radius:16px;padding:28px"><div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#777;margin-bottom:12px">Nexo Music Distribution</div><h1 style="font-size:24px;line-height:1.25;margin:0 0 18px">${escapeBroadcastHtml(title)}</h1><div style="font-size:15px;line-height:1.65">${paragraphs}</div><p style="margin:24px 0 0;font-size:12px;color:#777">This operational message was sent to your Nexo account email.</p></div></div></body></html>`;
}

async function processBroadcastBatch(broadcastId: string, limit = 25) {
  const service = createServiceClient();
  const { data: rows } = await service
    .from("email_outbound_events")
    .select("id")
    .eq("related_entity_type", "admin_email_broadcast")
    .eq("related_entity_id", broadcastId)
    .in("status", ["queued", "pending", "skipped"])
    .order("created_at", { ascending: true })
    .limit(limit);
  for (const row of rows ?? []) {
    await processEmailEvent(service, row.id);
  }
  const { data: allRows } = await service
    .from("email_outbound_events")
    .select("status")
    .eq("related_entity_type", "admin_email_broadcast")
    .eq("related_entity_id", broadcastId);
  const statuses = (allRows ?? []).map((row) => row.status);
  const pending = statuses.filter((status) => ["queued", "pending"].includes(status)).length;
  const failed = statuses.filter((status) => ["failed", "skipped"].includes(status)).length;
  const sent = statuses.filter((status) => status === "sent").length;
  const nextStatus = pending > 0 ? "processing" : failed > 0 ? "partial_failed" : "completed";
  await service
    .from("admin_email_broadcasts")
    .update({
      status: nextStatus,
      completed_at: pending === 0 ? new Date().toISOString() : null,
      error: failed > 0 ? `${failed} recipient(s) failed or were skipped; ${sent} sent.` : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", broadcastId);
}

export async function createEmailBroadcastAction(formData: FormData) {
  const ctx = await RequireAdminPermission("admin:notifications");
  const title = text(formData, "title");
  const subject = text(formData, "subject");
  const body = text(formData, "body");
  const audience = text(formData, "audience") || "all";
  if (!title || !subject || !body) return;
  const targetUser = uuidOrNull(text(formData, "target_user_id"));
  const country = text(formData, "country_code") || null;
  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("admin_email_broadcasts")
    .insert({
      title,
      subject,
      body_text: body,
      body_html: buildBroadcastHtml(title, body),
      audience,
      target_user_id: targetUser,
      country_code: country,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { error: queueError } = await supabase.rpc("queue_admin_email_broadcast", {
    p_broadcast_id: created.id,
  });
  if (queueError) throw new Error(queueError.message);
  after(async () => {
    try {
      await processBroadcastBatch(created.id, 25);
    } catch {
      // Queued rows remain authoritative and can be retried from the admin UI.
    }
  });
  revalidateOps();
}

export async function processEmailBroadcastBatchAction(formData: FormData) {
  await RequireAdminPermission("admin:notifications");
  const id = uuidOrNull(text(formData, "broadcast_id"));
  if (!id) return;
  await processBroadcastBatch(id, 50);
  revalidateOps();
}

export async function requestBulkTakedownApprovalAction(formData: FormData) {
  await RequireAdminPermission("admin:distribution");
  const rawIds = text(formData, "release_ids");
  const reason = text(formData, "reason");
  const releaseIds = [...new Set(rawIds.split(/[\s,]+/).map((id) => id.trim()).filter((id) => /^[0-9a-f-]{36}$/i.test(id)))].slice(0, 100);
  if (!releaseIds.length || !reason) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_admin_high_risk_request", {
    p_action_type: "bulk_release_takedown",
    p_target_type: "release_batch",
    p_target_id: null,
    p_payload: { release_ids: releaseIds, reason },
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  revalidateOps();
}

export async function executeBulkTakedownApprovalAction(formData: FormData) {
  await RequireAdminPermission("admin:distribution");
  const id = uuidOrNull(text(formData, "request_id"));
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("execute_bulk_takedown_request", { p_request_id: id });
  if (error) throw new Error(error.message);
  revalidateOps();
}


export async function executeApprovedAccountStatusAction(formData: FormData) {
  await RequireAdminPermission("admin:users");
  const id = uuidOrNull(text(formData, "request_id"));
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("execute_approved_account_status_request", {
    p_request_id: id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
  revalidatePath("/admin/artists");
  revalidatePath("/admin/labels");
  revalidateOps();
}
