"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
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
import { evaluateRoleAssignment, normalizeRoleList } from "@/lib/admin/roles";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  queueApprovedRelease,
  submitQueuedRelease,
  syncReleaseStatus,
  validateReleaseForDistributionLocally,
} from "@/lib/distribution/actions";
import { PROVIDER_DELIVERY_VALIDATION_CODE } from "@/lib/provider/errors";
import { formatDeliveryCorrection } from "@/lib/distribution/delivery-diagnostics";
import { isPublicBrandedEmail } from "@/lib/brand/contact";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };


function artistFacingDeliveryCorrection(message: string): string {
  const raw = message.trim();
  const flacTrack = raw.match(/Track\s+(\d+)\s+must use lossless FLAC/i);
  if (!flacTrack) return raw;

  return [
    "Audio File Requires Attention",
    "",
    `Track ${flacTrack[1]} cannot be delivered to distribution services because the uploaded audio file does not meet the required delivery format.`,
    "",
    "Please replace the current audio file with a lossless FLAC file and resubmit the release for review.",
    "",
    "Required format: FLAC (lossless audio)",
    "",
    "Once the corrected FLAC file has been uploaded, resubmit the release and our team will review it again.",
  ].join("\n");
}

function isProviderInternalOperationsFailure(message: string): boolean {
  const value = message.toLowerCase();
  return (
    (
      value.includes("even") &&
      (value.includes("not connected") || value.includes("connect an even account"))
    ) ||
    value.includes("delivery target has been disabled for this release") ||
    value.includes("please enter the store or additional store") ||
    (
      value.includes("tiktokstarttime") &&
      value.includes("does not match the format")
    )
  );
}

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

export type QcDecisionActionData = {
  qc: unknown;
  distribution?: {
    queued: unknown;
    submitted?: unknown;
    synced?: unknown;
    returnedForChanges?: unknown;
  };
  distributionWarning?: string;
};

export async function performQcDecisionAction(input: {
  releaseId: string;
  decision: QcDecision;
  checklist: QcChecklist;
  artistVisibleReason?: string;
  internalNote?: string;
}): Promise<ActionResult<QcDecisionActionData>> {
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

  if (input.decision === "approve") {
    const preflight = await validateReleaseForDistributionLocally(input.releaseId);
    if (!preflight.ok) {
      return {
        ok: false,
        error:
          `Cannot approve this release yet. Keep it in QC and use “Decline & return for changes” if the artist/label must correct it.\n\n${formatDeliveryCorrection(preflight.error)}`,
      };
    }
  }

  const { data, error } = await supabase.rpc("perform_qc_decision", {
    p_release_id: input.releaseId,
    p_decision: input.decision,
    p_checklist: checklist,
    p_artist_visible_reason: input.artistVisibleReason ?? null,
    p_internal_note: input.internalNote ?? null,
  });
  if (error) return { ok: false, error: error.message };

  let distribution: QcDecisionActionData["distribution"];
  let distributionWarning: string | undefined;

  // QC approval is the delivery hand-off. Submit immediately instead of leaving
  // the release waiting for a second manual queue/submit step.
  if (input.decision === "approve") {
    const queued = await queueApprovedRelease(
      input.releaseId,
      "Automatically queued after Nexo QC approval"
    );

    if (!queued.ok) {
      distributionWarning =
        `Release approved, but automatic distribution queueing needs attention: ${queued.error}`;
    } else {
      distribution = { queued: queued.data };
      const jobId =
        queued.data &&
        typeof queued.data === "object" &&
        "id" in queued.data &&
        typeof (queued.data as { id?: unknown }).id === "string"
          ? (queued.data as { id: string }).id
          : null;

      if (!jobId) {
        distributionWarning =
          "Release approved and queued, but Nexo could not resolve the distribution job ID for automatic submission.";
      } else {
        const submitted = await submitQueuedRelease(
          jobId,
          `qc-approval:${input.releaseId}`
        );

        if (!submitted.ok) {
          if (
            submitted.code === PROVIDER_DELIVERY_VALIDATION_CODE &&
            !isProviderInternalOperationsFailure(submitted.error)
          ) {
            const artistVisibleCorrection = artistFacingDeliveryCorrection(submitted.error);
            const { data: returned, error: returnError } = await supabase.rpc(
              "admin_reopen_release_for_corrections",
              {
                p_release_id: input.releaseId,
                p_reason: artistVisibleCorrection,
              }
            );

            if (!returnError) {
              distribution.returnedForChanges = returned;
              distributionWarning =
                `Release declined and returned to the artist/label for correction: ${artistVisibleCorrection}`;
            } else {
              distributionWarning =
                `Delivery validation failed: ${submitted.error} Nexo could not automatically return the release for correction: ${returnError.message}`;
            }
          } else if (isProviderInternalOperationsFailure(submitted.error)) {
            distributionWarning =
              "Release passed QC, but an internal/provider routing or formatting issue blocked delivery. Nexo kept the release in admin operations instead of returning it to the artist or label. Fix the delivery target/format internally, then retry distribution.";
          } else {
            distributionWarning =
              `Release approved and queued, but TooLost submission needs attention: ${submitted.error}`;
          }
        } else {
          distribution.submitted = submitted.data;

          // Submission is authoritative. Immediate sync reduces latency to the first
          // TooLost status; webhooks/subsequent syncs continue the real-time lifecycle.
          const synced = await syncReleaseStatus(jobId);
          if (synced.ok) {
            distribution.synced = synced.data;
          } else {
            distributionWarning =
              `TooLost accepted the release, but the immediate status sync did not complete: ${synced.error}`;
          }
        }
      }
    }
  }

  // Email delivery is secondary to the authoritative QC/distribution write.
  // Next.js after() lets the response return immediately while the outbox is
  // drained after streaming, so SMTP latency never holds the admin button open.
  after(async () => {
    try {
      const { drainQueuedOutbox } = await import("@/lib/email/hooks");
      await drainQueuedOutbox(20);
    } catch {
      // QC/distribution state remains authoritative even if SMTP is temporarily unavailable.
    }
  });

  revalidateAdmin([
    "/admin/qc",
    "/admin/releases",
    `/admin/releases/${input.releaseId}`,
    "/admin/distribution",
    "/admin/distribution/queue",
    "/admin/distribution/submissions",
    "/admin/distribution/delivery",
  ]);

  return {
    ok: true,
    data: {
      qc: data,
      ...(distribution ? { distribution } : {}),
      ...(distributionWarning ? { distributionWarning } : {}),
    },
  };
}
export async function bulkClaimQc(itemIds: string[]): Promise<ActionResult<{ claimed: number; failed: string[] }>> {
  await RequireAdminPermission("admin:qc");
  const ids = [...new Set(itemIds)].slice(0, 25);
  const supabase = await createClient();

  // These claims are independent. Running them together avoids up to 25 serial
  // network roundtrips while preserving each item's own RPC/locking rules.
  const results = await Promise.all(
    ids.map(async (id) => {
      const { error } = await supabase.rpc("claim_qc_item", { p_item_id: id });
      return { id, ok: !error };
    })
  );

  const failed = results.filter((result) => !result.ok).map((result) => result.id);
  const claimed = results.length - failed.length;
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
    const { enqueueTransactionalEmail } = await import("@/lib/email/hooks");
    const { data: target } = await supabase
      .from("profiles")
      .select("id, email, display_name, full_name")
      .eq("id", input.userId)
      .maybeSingle();
    const templateKey =
      input.status === "suspended" || input.status === "deactivated"
        ? "ACCOUNT_SUSPENDED"
        : input.restriction && input.restriction !== "none"
          ? "ACCOUNT_RESTRICTED"
          : input.status === "active"
            ? "ACCOUNT_RESTORED"
            : null;
    if (templateKey && target?.email) {
      await enqueueTransactionalEmail({
        supabase,
        templateKey,
        eventType: "account.status",
        to: target.email,
        recipientUserId: target.id,
        relatedEntityType: "profile",
        relatedEntityId: target.id,
        payload: {
          FIRST_NAME: target.display_name || target.full_name || "there",
          ACCOUNT_STATUS: input.status,
          STATUS: input.status.replace(/_/g, " "),
          RESTRICTION: input.restriction ?? "none",
          REASON: input.reason.trim(),
          CTA_URL: "https://nexomusicdistribution.com/dashboard",
          CTA_LABEL: "Open workspace",
          PREHEADER: `Account ${input.status.replace(/_/g, " ")} — ${input.reason.trim()}`,
        },
        idempotencyKey: `ACCOUNT:${templateKey}:${target.id}:${input.status}:${input.restriction ?? "none"}:${Date.now()}`,
      });
    }
  } catch {
    /* account change is independent of SMTP */
  }
  revalidateAdmin(["/admin/users", "/admin/artists", "/admin/labels"]);
  return { ok: true, data };
}

export async function setAccountPlanOverrideAction(input: {
  userId: string;
  accountType: "artist" | "label";
  planId: "artist_starter" | "artist_pro" | "label_starter" | "label_pro";
  billingInterval?: "month" | "year" | null;
  status: "active" | "trialing" | "past_due" | "expired" | "paused" | "canceled";
  endsAt?: string | null;
  reason?: string;
}): Promise<ActionResult<{
  endsAt: string | null;
  billingInterval: "month" | "year" | null;
  status: "active" | "trialing" | "past_due" | "expired" | "paused" | "canceled";
}>> {
  const ctx = await RequireAdminPermission("admin:billing_tools");
  const valid =
    input.accountType === "artist"
      ? ["artist_starter", "artist_pro"].includes(input.planId)
      : ["label_starter", "label_pro"].includes(input.planId);
  if (!valid) return { ok: false, error: "Plan does not match account type." };

  const paidPlan = input.planId !== "artist_starter";
  const billingInterval = paidPlan ? input.billingInterval ?? "month" : null;
  if (paidPlan && billingInterval !== "month" && billingInterval !== "year") {
    return { ok: false, error: "Choose monthly or yearly billing." };
  }

  const nowDate = new Date();
  const now = nowDate.toISOString();
  let normalizedEndsAt: string | null = null;
  if (input.endsAt?.trim()) {
    const parsed = new Date(input.endsAt);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "Plan end date is invalid." };
    }
    if (parsed.getTime() <= nowDate.getTime() && (input.status === "active" || input.status === "trialing")) {
      return { ok: false, error: "An active plan end date must be in the future." };
    }
    normalizedEndsAt = parsed.toISOString();
  } else if (paidPlan && (input.status === "active" || input.status === "trialing")) {
    const automaticEnd = new Date(nowDate);
    if (billingInterval === "year") {
      automaticEnd.setUTCFullYear(automaticEnd.getUTCFullYear() + 1);
    } else {
      automaticEnd.setUTCMonth(automaticEnd.getUTCMonth() + 1);
    }
    normalizedEndsAt = automaticEnd.toISOString();
  }

  const db = createServiceClient();
  const { data: existing } = await db
    .from("billing_entitlement_overrides")
    .select("created_by,created_at")
    .eq("user_id", input.userId)
    .maybeSingle();

  const reason = input.reason?.trim() || "Admin billing adjustment";
  const { error } = await db.from("billing_entitlement_overrides").upsert(
    {
      user_id: input.userId,
      account_type: input.accountType,
      plan_id: input.planId,
      billing_interval: billingInterval,
      status: input.status,
      starts_at: now,
      ends_at: normalizedEndsAt,
      reason,
      updated_by: ctx.userId,
      created_by: existing?.created_by ?? ctx.userId,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );
  if (error) return { ok: false, error: error.message };

  const { error: auditError } = await db.from("audit_logs").insert({
    actor_user_id: ctx.userId,
    action: "billing_plan_override",
    entity_type: "profile",
    entity_id: input.userId,
    metadata: {
      account_type: input.accountType,
      plan_id: input.planId,
      billing_interval: billingInterval,
      status: input.status,
      ends_at: normalizedEndsAt,
      reason,
    },
  });
  if (auditError) {
    return {
      ok: false,
      error: `Plan changed, but audit logging failed: ${auditError.message}`,
    };
  }

  revalidateAdmin([
    "/admin/users",
    "/admin/finance/billing",
    "/admin/tools/billing",
    "/dashboard",
    "/billing",
  ]);
  return {
    ok: true,
    data: {
      endsAt: normalizedEndsAt,
      billingInterval,
      status: input.status,
    },
  };
}

export async function clearAccountPlanOverrideAction(input: {
  userId: string;
  reason?: string;
}): Promise<ActionResult> {
  const ctx = await RequireAdminPermission("admin:billing_tools");
  const db = createServiceClient();

  const { data: current, error: readError } = await db
    .from("billing_entitlement_overrides")
    .select("plan_id,billing_interval,status,ends_at")
    .eq("user_id", input.userId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!current) return { ok: true, data: true };

  const { error } = await db
    .from("billing_entitlement_overrides")
    .delete()
    .eq("user_id", input.userId);
  if (error) return { ok: false, error: error.message };

  const { error: auditError } = await db.from("audit_logs").insert({
    actor_user_id: ctx.userId,
    action: "billing_plan_override_cleared",
    entity_type: "profile",
    entity_id: input.userId,
    metadata: {
      previous: current,
      reason: input.reason?.trim() || "Returned to Paddle billing truth",
    },
  });
  if (auditError) {
    return {
      ok: false,
      error: `Override cleared, but audit logging failed: ${auditError.message}`,
    };
  }

  revalidateAdmin([
    "/admin/users",
    "/admin/finance/billing",
    "/admin/tools/billing",
    "/dashboard",
    "/billing",
  ]);
  return { ok: true, data: true };
}

export async function inviteStaffUserAction(input: {
  email: string;
  baseRole?: Extract<AppRole, "support" | "admin" | "super_admin">;
  teamRoles?: string[];
}): Promise<ActionResult<{ userId: string }>> {
  const ctx = await RequireAdminPermission("admin:staff_invite");
  const email = input.email.trim().toLowerCase();
  if (!/^\\S+@\\S+\\.\\S+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const baseRole = input.baseRole ?? "support";
  if (
    baseRole !== "support" &&
    baseRole !== "admin" &&
    baseRole !== "super_admin"
  ) {
    return { ok: false, error: "Invalid staff account level." };
  }

  // Admins may build and manage functional staff teams. Only an existing
  // Super Admin can create another Administrator or Super Admin account.
  if (baseRole !== "support" && !ctx.roles.includes("super_admin")) {
    return {
      ok: false,
      error: "Only a Super Admin can grant Administrator or Super Admin access.",
    };
  }

  const teamRoles = [
    ...new Set(
      (input.teamRoles ?? [])
        .map((role) => role.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];

  if (baseRole === "support" && teamRoles.length === 0) {
    return {
      ok: false,
      error: "Choose at least one functional team role for this staff member.",
    };
  }

  try {
    const service = createServiceClient();

    if (baseRole === "support") {
      const { data: allowedTeams, error: teamError } = await service
        .from("staff_roles")
        .select("role_key")
        .eq("is_active", true)
        .in("role_key", teamRoles);
      if (teamError) return { ok: false, error: teamError.message };
      if ((allowedTeams ?? []).length !== teamRoles.length) {
        return {
          ok: false,
          error: "One or more selected team roles are invalid or inactive.",
        };
      }
    }

    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL || "https://nexomusicdistribution.com"}/login`;
    const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        invited_by: ctx.userId,
        nexo_staff_invite: true,
        nexo_staff_role: baseRole,
        nexo_staff_teams: baseRole === "support" ? teamRoles : [],
      },
    });
    if (error) return { ok: false, error: error.message };
    if (!data.user?.id) {
      return { ok: false, error: "Invitation did not return a user." };
    }

    const invitedUserId = data.user.id;
    const failSetup = async (message: string): Promise<ActionResult<{ userId: string }>> => {
      try {
        await service.auth.admin.deleteUser(invitedUserId);
      } catch {
        // Best effort cleanup. Never leave a partially privileged account.
      }
      return { ok: false, error: message };
    };

    const { error: roleError } = await service.from("user_roles").upsert(
      [{ user_id: invitedUserId, role: baseRole }],
      { onConflict: "user_id,role" }
    );
    if (roleError) return failSetup(roleError.message);

    const { error: defaultRoleError } = await service
      .from("user_roles")
      .delete()
      .eq("user_id", invitedUserId)
      .eq("role", "public_user");
    if (defaultRoleError) return failSetup(defaultRoleError.message);

    const { error: profileError } = await service
      .from("profiles")
      .update({ account_status: "active", account_type: baseRole })
      .eq("id", invitedUserId);
    if (profileError) return failSetup(profileError.message);

    if (baseRole === "support" && teamRoles.length > 0) {
      const { error: assignmentError } = await service
        .from("staff_role_assignments")
        .insert(
          teamRoles.map((roleKey) => ({
            user_id: invitedUserId,
            role_key: roleKey,
            assigned_by: ctx.userId,
          }))
        );
      if (assignmentError) return failSetup(assignmentError.message);
    }

    // Service-role audit write is intentional: role_change is reserved for
    // privileged role operations and the actor is captured explicitly.
    await service.from("audit_logs").insert({
      actor_user_id: ctx.userId,
      action: "role_change",
      entity_type: "staff_invite",
      entity_id: invitedUserId,
      metadata: {
        email,
        base_role: baseRole,
        team_roles: baseRole === "support" ? teamRoles : [],
      },
    });

    revalidateAdmin(["/admin/users", "/admin/roles", "/admin/audit"]);
    return { ok: true, data: { userId: invitedUserId } };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not send invitation.",
    };
  }
}

export async function setStaffTeamRolesAction(input: {
  userId: string;
  teamRoles: string[];
}): Promise<ActionResult<{ assigned: number }>> {
  await RequireAdminPermission("admin:staff_invite");
  const userId = input.userId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return { ok: false, error: "Valid staff user ID required." };
  }

  const teamRoles = [
    ...new Set(
      input.teamRoles
        .map((role) => role.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_staff_team_roles", {
    p_target: userId,
    p_role_keys: teamRoles,
  });
  if (error) return { ok: false, error: error.message };

  revalidateAdmin(["/admin/roles", "/admin/users", "/admin/audit"]);
  return {
    ok: true,
    data: { assigned: typeof data === "number" ? data : teamRoles.length },
  };
}


export async function setUserRolesAction(input: {
  userId: string;
  roles: AppRole[];
}): Promise<ActionResult> {
  const ctx = await RequireSuperAdmin();
  const supabase = await createClient();

  const [{ data: currentRows }, { count: superCount }, { data: label }, { count: releaseCount }] =
    await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", input.userId),
      supabase
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "super_admin"),
      supabase.from("label_profiles").select("id").eq("user_id", input.userId).maybeSingle(),
      supabase
        .from("releases")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", input.userId),
    ]);

  let rosterCount = 0;
  if (label?.id) {
    const { count } = await supabase
      .from("label_roster_artists")
      .select("id", { count: "exact", head: true })
      .eq("label_profile_id", label.id);
    rosterCount = count ?? 0;
  }

  const gate = evaluateRoleAssignment({
    actorId: ctx.userId,
    targetId: input.userId,
    currentRoles: (currentRows ?? []).map((r) => r.role as AppRole),
    nextRoles: input.roles,
    superAdminCount: superCount ?? 0,
    hasLabelRoster: rosterCount > 0,
    hasArtistOwnedReleases: (releaseCount ?? 0) > 0,
  });
  if (!gate.ok) return { ok: false, error: gate.error };

  const { error } = await supabase.rpc("super_admin_set_roles", {
    p_target: input.userId,
    p_roles: gate.roles,
  });
  if (error) return { ok: false, error: error.message };
  revalidateAdmin(["/admin/users", "/admin/roles"]);
  return { ok: true, data: true };
}

export async function replyContactMessageAction(input: {
  id: string;
  body: string;
}): Promise<ActionResult<{ messageId?: string; status: string }>> {
  await RequireAdminPermission("admin:contact");
  const reply = input.body.trim();
  if (!reply) return { ok: false, error: "Reply body is required." };
  const supabase = await createClient();
  const { data: row, error: readErr } = await supabase
    .from("contact_messages")
    .select("id, name, email, subject, message, status")
    .eq("id", input.id)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };
  if (!row?.email) return { ok: false, error: "Contact message not found." };

  const { sendComposedEmail } = await import("@/lib/email/compose-send");
  const { contactReplyBodyHtml } = await import("@/lib/email/branded-html");
  const { replySubject } = await import("@/lib/email/thread");
  const bodyHtml = contactReplyBodyHtml({
    visitorName: row.name,
    originalSubject: row.subject,
    originalMessage: row.message,
    replyBody: reply,
  });
  const sent = await sendComposedEmail(supabase, {
    to: row.email,
    subject: replySubject(row.subject),
    bodyHtml,
    branded: true,
  });
  if (!sent.ok) return { ok: false, error: sent.error };
  if (sent.status !== "sent") {
    return {
      ok: false,
      error:
        sent.status === "skipped"
          ? "Zoho SMTP is not connected — reply was not sent."
          : "Reply failed to send via Zoho SMTP.",
    };
  }

  const { error: updErr } = await supabase
    .from("contact_messages")
    .update({
      status: "replied",
      replied_at: new Date().toISOString(),
      reply_outbound_event_id: sent.eventId,
    })
    .eq("id", input.id);
  if (updErr) return { ok: false, error: updErr.message };

  try {
    await supabase.rpc("write_audit_log", {
      p_action: "contact_reply",
      p_entity_type: "contact_message",
      p_entity_id: input.id,
      p_metadata: { to: row.email, outbound_event_id: sent.eventId, status: sent.status },
    });
  } catch {
    /* reply already sent */
  }

  revalidateAdmin(["/admin/contact"]);
  return { ok: true, data: { messageId: sent.messageId, status: sent.status } };
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
    if (input.internal !== true) {
      try {
        const { enqueueTransactionalEmail } = await import("@/lib/email/hooks");
        const { data: ticket } = await supabase
          .from("support_tickets")
          .select("id, subject, status, requester_user_id")
          .eq("id", input.ticketId)
          .maybeSingle();
        if (ticket?.requester_user_id) {
          const { data: requester } = await supabase
            .from("profiles")
            .select("id, email, display_name")
            .eq("id", ticket.requester_user_id)
            .maybeSingle();
          if (requester?.email) {
            await enqueueTransactionalEmail({
              supabase,
              templateKey: "SUPPORT_TICKET_REPLY",
              eventType: "support",
              to: requester.email,
              recipientUserId: requester.id,
              relatedEntityType: "support_ticket",
              relatedEntityId: ticket.id,
              payload: {
                FIRST_NAME: requester.display_name || "there",
                SUPPORT_TICKET_ID: ticket.id,
                TICKET_SUBJECT: ticket.subject ?? "Support",
                STATUS: ticket.status ?? "open",
                REASON: input.reply.trim(),
                REPLY_BODY: input.reply.trim(),
                CTA_URL: "https://nexomusicdistribution.com/support",
                CTA_LABEL: "View reply",
                PREHEADER: `New support reply — ${ticket.subject ?? "Support"}`,
              },
              idempotencyKey: `SUPPORT_TICKET_REPLY:${ticket.id}:${Date.now()}`,
              createdBy: ctx.userId,
            });
          }
        }
      } catch {
        /* reply is stored regardless */
      }
    }
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
  value: unknown;
}): Promise<ActionResult> {
  const ctx = await RequireAdminPermission("admin:settings");
  const key = input.key.trim().toLowerCase();
  if (!isAllowedAdminSettingKey(key)) {
    return { ok: false, error: "Setting key is not allowlisted." };
  }
  if (/(secret|password|token|service_role|api[_-]?key)/i.test(key)) {
    return { ok: false, error: "Secrets are not allowed in settings." };
  }
  const raw = JSON.stringify(input.value ?? null);
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

export async function savePublicContactMailboxesAction(input: {
  contactEmail: string;
  supportEmail: string;
  dmcaEmail: string;
  inquiriesEmail: string;
}): Promise<ActionResult> {
  const ctx = await RequireAdminPermission("admin:settings");
  const values = {
    contact_email: input.contactEmail.trim().toLowerCase(),
    support_email: input.supportEmail.trim().toLowerCase(),
    dmca_email: input.dmcaEmail.trim().toLowerCase(),
    inquiries_email: input.inquiriesEmail.trim().toLowerCase(),
  };

  for (const [key, value] of Object.entries(values)) {
    if (!isPublicBrandedEmail(value)) {
      return {
        ok: false,
        error: `${key.replace(/_/g, " ")} must use a Nexo branded email domain.`,
      };
    }
  }

  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("website_settings")
    .select("value")
    .eq("key", "footer")
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };

  const merged = {
    ...((current?.value && typeof current.value === "object" && !Array.isArray(current.value)
      ? current.value
      : {}) as Record<string, unknown>),
    ...values,
  };

  const { error } = await supabase.from("website_settings").upsert({
    key: "footer",
    value: merged,
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };

  await supabase.rpc("write_audit_log", {
    p_action: "settings_update",
    p_entity_type: "website_settings",
    p_entity_id: null,
    p_metadata: { key: "footer", fields: Object.keys(values) },
  });

  revalidateAdmin(["/admin/settings", "/admin/pages", "/admin/website"]);
  revalidatePath("/contact");
  revalidatePath("/", "layout");
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
