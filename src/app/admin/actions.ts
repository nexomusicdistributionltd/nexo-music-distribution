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
import { enqueueEmailEvent } from "@/lib/email/enqueue";
import { processEmailEvent } from "@/lib/email/outbox";
import {
  templateKeysForQcDecision,
} from "@/lib/email/catalog";
import { assertEnqueueableTemplateKey } from "@/lib/email/template-keys";
import { resolveProfileRecipient, resolveReleaseOwnerRecipient } from "@/lib/email/resolve-recipient";
import { createServiceClient } from "@/lib/supabase/admin";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function revalidateAdmin(paths: string[] = []) {
  revalidatePath("/admin");
  for (const p of paths) revalidatePath(p);
}

export async function claimQcItem(itemId: string): Promise<ActionResult> {
  await RequireAdminPermission("admin:qc");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_qc_item", { p_item_id: itemId });
  if (error) return { ok: false, error: error.message };
  revalidateAdmin(["/admin/qc", "/admin/releases"]);
  return { ok: true, data };
}

export async function releaseQcClaim(itemId: string): Promise<ActionResult> {
  await RequireAdminPermission("admin:qc");
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
  await RequireAdminPermission("admin:qc");
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
  const qcCtx = await RequireAdminPermission("admin:qc");
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

  // Enqueue operational email ONLY after successful QC RPC (SQL also enqueues; app path is belt-and-suspenders)
  try {
    const owner = await resolveReleaseOwnerRecipient(supabase, input.releaseId);
    const keys = templateKeysForQcDecision(input.decision);
    const reviewId =
      data && typeof data === "object" && data !== null && "id" in data
        ? String((data as { id: string }).id)
        : crypto.randomUUID();
    for (const templateKey of keys) {
      const enq = await enqueueEmailEvent(supabase, {
        eventType: "release.qc",
        templateKey,
        recipientUserId: owner?.userId ?? null,
        recipientEmail: owner?.email ?? null,
        relatedReleaseId: input.releaseId,
        relatedEntityType: "qc_review",
        relatedEntityId: reviewId,
        payload: {
          RELEASE_ID: input.releaseId,
          ARTIST_VISIBLE_REASON: input.artistVisibleReason ?? "",
          STATUS: input.decision,
        },
        idempotencyKey: `${templateKey}:${input.releaseId}:${input.decision}:app:${reviewId}`,
        createdBy: qcCtx.userId,
      });
      if (enq.id) {
        try {
          const svc = createServiceClient();
          await processEmailEvent(svc, enq.id);
        } catch {
          // Provider may be unavailable — leave pending/unavailable; never fake sent
        }
      }
    }
  } catch {
    // Do not fail the QC action if enqueue/process fails
  }

  revalidateAdmin([
    "/admin/qc",
    "/admin/releases",
    `/admin/releases/${input.releaseId}`,
    "/admin/emails",
  ]);
  return { ok: true, data };
}

export async function bulkClaimQc(itemIds: string[]): Promise<ActionResult<{ claimed: number; failed: string[] }>> {
  await RequireAdminPermission("admin:qc");
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

  try {
    const profile = await resolveProfileRecipient(supabase, input.userId);
    const templateKey =
      input.status === "suspended"
        ? "ACCOUNT_SUSPENDED"
        : input.status === "active"
          ? "ACCOUNT_RESTORED"
          : input.restriction && input.restriction !== "none"
            ? "ACCOUNT_RESTRICTED"
            : null;
    if (templateKey && profile) {
      const enq = await enqueueEmailEvent(supabase, {
        eventType: "account.status",
        templateKey,
        recipientUserId: profile.userId,
        recipientEmail: profile.email,
        relatedEntityType: "profile",
        relatedEntityId: input.userId,
        payload: {
          STATUS: input.status,
          ARTIST_VISIBLE_REASON: input.reason.trim(),
          FIRST_NAME: profile.displayName ?? "",
        },
        idempotencyKey: `${templateKey}:${input.userId}:${input.status}:app:${crypto.randomUUID()}`,
      });
      if (enq.id) {
        try {
          await processEmailEvent(createServiceClient(), enq.id);
        } catch {
          /* provider unavailable */
        }
      }
    }
  } catch {
    /* non-fatal */
  }

  revalidateAdmin(["/admin/users", "/admin/artists", "/admin/labels", "/admin/emails"]);
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
    const { data: msg, error } = await supabase.from("support_messages").insert({
      ticket_id: input.ticketId,
      author_user_id: ctx.userId,
      body: input.reply.trim(),
      is_internal: input.internal === true,
    }).select("id").maybeSingle();
    if (error) return { ok: false, error: error.message };

    // Non-internal staff replies: SQL trigger also enqueues; app path optional process
    if (input.internal !== true && msg?.id) {
      try {
        const { data: ticket } = await supabase
          .from("support_tickets")
          .select("requester_user_id")
          .eq("id", input.ticketId)
          .maybeSingle();
        if (ticket?.requester_user_id) {
          const recipient = await resolveProfileRecipient(supabase, ticket.requester_user_id);
          if (recipient) {
            const enq = await enqueueEmailEvent(supabase, {
              eventType: "support",
              templateKey: "SUPPORT_TICKET_REPLY",
              recipientUserId: recipient.userId,
              recipientEmail: recipient.email,
              relatedEntityType: "support_message",
              relatedEntityId: msg.id,
              payload: { FIRST_NAME: recipient.displayName ?? "", STATUS: "reply" },
              idempotencyKey: `SUPPORT_TICKET_REPLY:${msg.id}:app`,
              createdBy: ctx.userId,
            });
            if (enq.id) {
              try {
                await processEmailEvent(createServiceClient(), enq.id);
              } catch {
                /* unavailable */
              }
            }
          }
        }
      } catch {
        /* non-fatal */
      }
    }
  }

  revalidateAdmin(["/admin/support", "/admin/emails"]);
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
  const { data: before } = await supabase
    .from("compliance_cases")
    .select("id, subject_user_id, status, title")
    .eq("id", input.id)
    .maybeSingle();
  const { error } = await supabase.from("compliance_cases").update(patch).eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  try {
    if (input.status && before?.subject_user_id) {
      const recipient = await resolveProfileRecipient(supabase, before.subject_user_id);
      const templateKey =
        input.status === "investigating"
          ? "COMPLIANCE_WARNING"
          : input.status === "resolved" || input.status === "dismissed"
            ? "COMPLIANCE_APPEAL_DECISION"
            : null;
      if (templateKey && recipient) {
        const enq = await enqueueEmailEvent(supabase, {
          eventType: "compliance",
          templateKey,
          recipientUserId: recipient.userId,
          recipientEmail: recipient.email,
          relatedEntityType: "compliance_case",
          relatedEntityId: input.id,
          payload: {
            STATUS: input.status,
            FIRST_NAME: recipient.displayName ?? "",
            ARTIST_VISIBLE_REASON: input.summary ?? "",
          },
          idempotencyKey: `${templateKey}:${input.id}:${input.status}`,
        });
        if (enq.id) {
          try {
            await processEmailEvent(createServiceClient(), enq.id);
          } catch {
            /* unavailable */
          }
        }
      }
    }
  } catch {
    /* non-fatal */
  }

  revalidateAdmin(["/admin/compliance", "/admin/emails"]);
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
  await supabase.rpc("write_audit_log", {
    p_action: "settings_update",
    p_entity_type: "admin_setting",
    p_entity_id: null,
    p_metadata: { key },
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

  await supabase.rpc("write_audit_log", {
    p_action: "report_export",
    p_entity_type: "report_export",
    p_entity_id: data.id,
    p_metadata: { report_type: input.reportType },
  });

  revalidateAdmin(["/admin/reports", "/admin/audit"]);
  return { ok: true, data: { id: data.id } };
}

/** Retry an email event: creates a NEW row with :retry:{uuid} idempotency suffix. Cannot fabricate SENT. */
export async function retryEmailEventAction(eventId: string): Promise<ActionResult<{ id: string | null }>> {
  const ctx = await RequireAdminPermission("admin:emails");
  const supabase = await createClient();
  const { data: existing, error } = await supabase
    .from("email_events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!existing) return { ok: false, error: "Email event not found." };

  const retryKey = `${existing.idempotency_key}:retry:${crypto.randomUUID()}`;
  const templateKey = assertEnqueueableTemplateKey(String(existing.template_key));
  const enq = await enqueueEmailEvent(supabase, {
    eventType: "manual.retry",
    templateKey,
    recipientUserId: existing.recipient_user_id,
    recipientEmail: existing.recipient_email,
    relatedReleaseId: existing.related_release_id,
    relatedEntityType: existing.related_entity_type,
    relatedEntityId: existing.related_entity_id,
    payload: {
      ...(typeof existing.payload === "object" && existing.payload ? existing.payload : {}),
      RETRY_OF: eventId,
    },
    idempotencyKey: retryKey,
    createdBy: ctx.userId,
  });
  if (enq.error) return { ok: false, error: enq.error };

  await supabase.rpc("write_audit_log", {
    p_action: "email_retry",
    p_entity_type: "email_event",
    p_entity_id: enq.id,
    p_metadata: { retry_of: eventId, template_key: existing.template_key },
  });

  if (enq.id) {
    try {
      await processEmailEvent(createServiceClient(), enq.id);
    } catch {
      /* unavailable — status stays truthful */
    }
  }

  revalidateAdmin(["/admin/emails"]);
  return { ok: true, data: { id: enq.id } };
}
