"use server";

import { revalidatePath } from "next/cache";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { enqueueEmailEvent } from "@/lib/email/enqueue";
import { processEmailEvent } from "@/lib/email/outbox";
import {
  campaignIdempotencyKey,
  eventTypeForTemplateCategory,
  MANUAL_SEND_MAX_RECIPIENTS,
  parseSelectedUserIds,
  sendOutcomeMessage,
  summarizeSendResults,
} from "@/lib/email/campaign";
import {
  assertEnqueueableTemplateKey,
  ensureUniqueTemplateKey,
  isProtectedSeedCategory,
  isValidTemplateKeyFormat,
  slugifyTemplateKey,
} from "@/lib/email/template-keys";
import { composeCustomFromShell, seedMissingEmailTemplates } from "@/lib/email/stored";
import { getEmailProviderStatus } from "@/lib/email/provider";
import { resolveAdminCampaignRecipients } from "@/lib/email/admin-recipients";
import type { StoredTemplateCategory } from "@/lib/email/types";
import type { ActionResult } from "@/app/admin/actions";
import type { AdminSelectAllKind } from "@/lib/email/campaign";

function revalidateEmailAdmin() {
  revalidatePath("/admin/emails");
  revalidatePath("/admin/emails/templates");
  revalidatePath("/admin/emails/send");
  revalidatePath("/admin/emails/compose");
  revalidatePath("/admin/emails/sent");
  revalidatePath("/admin/emails/failed");
  revalidatePath("/admin/emails/activity");
  revalidatePath("/admin/emails/automated");
}

export async function seedEmailTemplatesAction(): Promise<
  ActionResult<{ inserted: number; skipped: number }>
> {
  const ctx = await RequireAdminPermission("admin:emails");
  const supabase = await createClient();
  const result = await seedMissingEmailTemplates(supabase, ctx.userId);
  if (result.error) return { ok: false, error: result.error };
  revalidateEmailAdmin();
  return { ok: true, data: { inserted: result.inserted, skipped: result.skipped } };
}

export async function updateEmailTemplateAction(input: {
  key: string;
  name: string;
  subject: string;
  htmlBody: string;
}): Promise<ActionResult<{ key: string }>> {
  await RequireAdminPermission("admin:emails");
  const key = assertEnqueueableTemplateKey(input.key);
  const name = input.name.trim();
  const subject = input.subject.trim();
  const htmlBody = input.htmlBody.trim();
  if (!name) return { ok: false, error: "Name is required." };
  if (!subject) return { ok: false, error: "Subject is required." };
  if (!htmlBody) return { ok: false, error: "HTML body is required." };
  if (htmlBody.length > 400_000) return { ok: false, error: "HTML body is too large." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("email_templates")
    .update({ name, subject, html_body: htmlBody })
    .eq("key", key);
  if (error) return { ok: false, error: error.message };

  await supabase.rpc("write_audit_log", {
    p_action: "email_template_write",
    p_entity_type: "email_template",
    p_entity_id: null,
    p_metadata: { key, op: "update" },
  });

  revalidateEmailAdmin();
  revalidatePath(`/admin/emails/templates/${encodeURIComponent(key)}`);
  return { ok: true, data: { key } };
}

export async function createEmailTemplateFromShellAction(input: {
  name: string;
  key?: string;
  subject?: string;
  preheader?: string;
}): Promise<ActionResult<{ key: string }>> {
  const ctx = await RequireAdminPermission("admin:emails");
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name is required." };

  const supabase = await createClient();
  const { data: existing, error: listError } = await supabase
    .from("email_templates")
    .select("key");
  if (listError) return { ok: false, error: listError.message };

  const taken = (existing ?? []).map((r) => String(r.key));
  const requested = input.key?.trim()
    ? input.key.trim().toUpperCase()
    : slugifyTemplateKey(name);
  if (!isValidTemplateKeyFormat(requested)) {
    return { ok: false, error: "Key must be uppercase letters, numbers, and underscores." };
  }
  let key: string;
  try {
    key = assertEnqueueableTemplateKey(ensureUniqueTemplateKey(requested, taken));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid key" };
  }

  const html = await composeCustomFromShell({
    name,
    preheader: input.preheader?.trim() || name,
  });
  const subject = input.subject?.trim() || name;

  const { error } = await supabase.from("email_templates").insert({
    key,
    name,
    category: "custom" satisfies StoredTemplateCategory,
    subject,
    html_body: html,
    created_by: ctx.userId,
  });
  if (error) return { ok: false, error: error.message };

  await supabase.rpc("write_audit_log", {
    p_action: "email_template_write",
    p_entity_type: "email_template",
    p_entity_id: null,
    p_metadata: { key, op: "create_from_shell" },
  });

  revalidateEmailAdmin();
  return { ok: true, data: { key } };
}

export async function deleteEmailTemplateAction(
  key: string
): Promise<ActionResult<{ key: string }>> {
  await RequireAdminPermission("admin:emails");
  const templateKey = assertEnqueueableTemplateKey(key);
  const supabase = await createClient();
  const { data, error: loadError } = await supabase
    .from("email_templates")
    .select("key, category")
    .eq("key", templateKey)
    .maybeSingle();
  if (loadError) return { ok: false, error: loadError.message };
  if (!data) return { ok: false, error: "Template not found." };
  if (isProtectedSeedCategory(String(data.category))) {
    return { ok: false, error: "Seeded ops and newsletter templates cannot be deleted." };
  }

  const { error } = await supabase.from("email_templates").delete().eq("key", templateKey);
  if (error) return { ok: false, error: error.message };

  await supabase.rpc("write_audit_log", {
    p_action: "email_template_write",
    p_entity_type: "email_template",
    p_entity_id: null,
    p_metadata: { key: templateKey, op: "delete" },
  });

  revalidateEmailAdmin();
  return { ok: true, data: { key: templateKey } };
}

export async function sendEmailTemplateAction(input: {
  templateKey: string;
  selectAll: boolean;
  selectAllKind?: AdminSelectAllKind | null;
  userIds: string[];
  artistIds?: string[];
  labelIds?: string[];
  customEmails?: string[];
  confirmed: boolean;
}): Promise<
  ActionResult<{
    campaignId: string;
    enqueued: number;
    skippedWithoutEmail: number;
    duplicateSkipped: number;
    statuses: Record<string, number>;
    message: string;
    providerConfigured: boolean;
  }>
> {
  const ctx = await RequireAdminPermission("admin:emails");
  if (!input.confirmed) {
    return { ok: false, error: "Confirm the send before enqueueing." };
  }
  const templateKey = assertEnqueueableTemplateKey(input.templateKey);
  const supabase = await createClient();
  const { data: tmpl, error: tmplError } = await supabase
    .from("email_templates")
    .select("key, category, name, subject")
    .eq("key", templateKey)
    .maybeSingle();
  if (tmplError) return { ok: false, error: tmplError.message };
  if (!tmpl) {
    return {
      ok: false,
      error: "Template not found in email_templates. Open Templates and seed from the catalog first.",
    };
  }

  const selectedIds = parseSelectedUserIds(input.userIds);
  const artistIds = parseSelectedUserIds(input.artistIds ?? []);
  const labelIds = parseSelectedUserIds(input.labelIds ?? []);
  const customEmails = input.customEmails ?? [];
  const selectAllKind = input.selectAllKind ?? (input.selectAll ? "user" : null);
  if (!selectAllKind && selectedIds.length === 0 && artistIds.length === 0 && labelIds.length === 0 && customEmails.length === 0) {
    return { ok: false, error: "Select at least one artist, label, user, or typed email address." };
  }

  let resolved: Awaited<ReturnType<typeof resolveAdminCampaignRecipients>>;
  try {
    resolved = await resolveAdminCampaignRecipients(supabase, {
      selectAllKind,
      userIds: selectedIds,
      artistIds,
      labelIds,
      customEmails,
      limit: MANUAL_SEND_MAX_RECIPIENTS,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to resolve recipients." };
  }

  if (resolved.recipients.length === 0) {
    return { ok: false, error: "No recipients with an email address were found." };
  }
  if (resolved.recipients.length > MANUAL_SEND_MAX_RECIPIENTS) {
    return {
      ok: false,
      error: `Recipient cap is ${MANUAL_SEND_MAX_RECIPIENTS}. Narrow the selection.`,
    };
  }

  const campaignId = crypto.randomUUID();
  const eventType = eventTypeForTemplateCategory(String(tmpl.category));
  let enqueued = 0;
  let duplicateSkipped = 0;
  const eventIds: string[] = [];

  for (const recipient of resolved.recipients) {
    const enq = await enqueueEmailEvent(supabase, {
      eventType,
      templateKey,
      recipientUserId: recipient.userId,
      recipientEmail: recipient.email,
      relatedEntityType: "email_campaign",
      relatedEntityId: campaignId,
      payload: {
        FIRST_NAME: recipient.displayName ?? "",
        CAMPAIGN_ID: campaignId,
        TEMPLATE_NAME: tmpl.name,
        RECIPIENT_SOURCE: recipient.source,
      },
      idempotencyKey: campaignIdempotencyKey(campaignId, recipient.userId ?? recipient.email),
      createdBy: ctx.userId,
    });
    if (enq.error) return { ok: false, error: enq.error };
    if (!enq.id) {
      duplicateSkipped += 1;
      continue;
    }
    enqueued += 1;
    eventIds.push(enq.id);
  }

  const processed: Array<{ status: string }> = [];
  for (const id of eventIds) {
    try {
      const result = await processEmailEvent(supabase, id);
      processed.push({ status: result.status });
    } catch {
      processed.push({ status: "queued" });
    }
  }

  const statuses = summarizeSendResults(processed);
  const provider = getEmailProviderStatus();

  await supabase.rpc("write_audit_log", {
    p_action: "email_manual_send",
    p_entity_type: "email_campaign",
    p_entity_id: campaignId,
    p_metadata: {
      template_key: templateKey,
      select_all: input.selectAll,
      select_all_kind: selectAllKind,
      custom_email_count: customEmails.length,
      enqueued,
      skipped_without_email: resolved.skippedWithoutEmail,
      statuses,
      provider_configured: provider.configured,
    },
  });

  revalidateEmailAdmin();
  return {
    ok: true,
    data: {
      campaignId,
      enqueued,
      skippedWithoutEmail: resolved.skippedWithoutEmail,
      duplicateSkipped,
      statuses,
      message: sendOutcomeMessage(statuses, provider.configured),
      providerConfigured: provider.configured,
    },
  };
}

function revalidateInbox() {
  revalidatePath("/admin/emails");
  revalidatePath("/admin/emails/compose");
  revalidatePath("/admin/emails/sent");
}

export async function syncInboxAction(): Promise<
  ActionResult<{ upserted: number; message: string }>
> {
  const ctx = await RequireAdminPermission("admin:emails");
  const supabase = await createClient();
  const { syncZohoInbox } = await import("@/lib/email/inbox-sync");
  const result = await syncZohoInbox(supabase, { limit: 50 });
  if (!result.ok) return { ok: false, error: result.error };

  await supabase.rpc("write_audit_log", {
    p_action: "email_inbox_sync",
    p_entity_type: "email_inbox",
    p_entity_id: null,
    p_metadata: { upserted: result.upserted, actor: ctx.userId },
  });
  revalidateInbox();
  return {
    ok: true,
    data: {
      upserted: result.upserted,
      message: `Synced ${result.upserted} message(s) from Zoho IMAP. Inbox is not copied from sent mail.`,
    },
  };
}

export async function markInboxSeenAction(
  id: string,
  seen: boolean
): Promise<ActionResult<{ id: string }>> {
  await RequireAdminPermission("admin:emails");
  const supabase = await createClient();
  const { error } = await supabase
    .from("email_inbox_messages")
    .update({ seen })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidateInbox();
  return { ok: true, data: { id } };
}

export async function saveDraftAction(input: {
  id?: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  htmlBody: string;
  inReplyTo?: string;
  references?: string;
  replyToInboxId?: string;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await RequireAdminPermission("admin:emails");
  const supabase = await createClient();
  const row = {
    created_by: ctx.userId,
    to_text: input.to,
    cc_text: input.cc,
    bcc_text: input.bcc,
    subject: input.subject,
    html_body: input.htmlBody,
    in_reply_to: input.inReplyTo ?? null,
    references_header: input.references ?? null,
    reply_to_inbox_id: input.replyToInboxId || null,
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { error } = await supabase.from("email_drafts").update(row).eq("id", input.id);
    if (error) return { ok: false, error: error.message };
    revalidateInbox();
    return { ok: true, data: { id: input.id } };
  }
  const { data, error } = await supabase.from("email_drafts").insert(row).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not save draft." };
  revalidateInbox();
  return { ok: true, data: { id: data.id } };
}

export async function sendComposedEmailAction(formData: FormData): Promise<
  ActionResult<{ eventId: string; status: string; message: string }>
> {
  const ctx = await RequireAdminPermission("admin:emails");
  const { sendComposedEmail } = await import("@/lib/email/compose-send");
  const { assertOutboundAttachment } = await import("@/lib/email/attachments");
  const files = formData.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0);
  const attachments = [];
  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer());
    const check = assertOutboundAttachment({
      filename: file.name,
      contentType: file.type,
      size: buf.length,
    });
    if (!check.ok) return { ok: false, error: check.error };
    attachments.push({ filename: file.name, content: buf, contentType: file.type });
  }

  const supabase = await createClient();
  const result = await sendComposedEmail(supabase, {
    to: String(formData.get("to") ?? ""),
    cc: String(formData.get("cc") ?? ""),
    bcc: String(formData.get("bcc") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    bodyHtml: String(formData.get("body_html") ?? ""),
    bodyText: String(formData.get("body_text") ?? ""),
    branded: formData.get("branded") !== "0",
    inReplyTo: String(formData.get("in_reply_to") ?? "") || undefined,
    references: String(formData.get("references") ?? "") || undefined,
    attachments,
    createdBy: ctx.userId,
  });
  if (!result.ok) return { ok: false, error: result.error };

  await supabase.rpc("write_audit_log", {
    p_action: "email_compose_send",
    p_entity_type: "email_outbound_event",
    p_entity_id: result.eventId,
    p_metadata: { status: result.status, provider: "zoho-smtp" },
  });

  const draftId = String(formData.get("draft_id") ?? "");
  if (draftId && result.status === "sent") {
    await supabase.from("email_drafts").delete().eq("id", draftId);
  }

  revalidateInbox();
  const message =
    result.status === "sent"
      ? `Sent via Zoho SMTP (${result.messageId}).`
      : result.status === "skipped"
        ? "Zoho SMTP is not configured — queued/skipped. Nothing was marked sent."
        : result.status === "failed"
          ? "Send failed. Status is failed, not sent."
          : `Status: ${result.status}.`;
  return {
    ok: true,
    data: { eventId: result.eventId, status: result.status, message },
  };
}

export async function retryEmailEventAction(eventId: string): Promise<ActionResult<{ id: string | null }>> {
  const ctx = await RequireAdminPermission("admin:emails");
  const supabase = await createClient();
  const { data: existing, error } = await supabase
    .from("email_outbound_events")
    .select("id, to_email, template_key, payload, related_entity_type, related_entity_id")
    .eq("id", eventId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!existing) return { ok: false, error: "Event not found." };

  const { assertOutboundTemplateKey } = await import("@/lib/email/template-keys");
  const templateKey = assertOutboundTemplateKey(String(existing.template_key));
  const payload = (existing.payload ?? {}) as Record<string, unknown>;
  const enq = await enqueueEmailEvent(supabase, {
    eventType: "manual.retry",
    templateKey,
    recipientEmail: existing.to_email ? String(existing.to_email) : null,
    relatedEntityType: existing.related_entity_type,
    relatedEntityId: existing.related_entity_id,
    relatedReleaseId:
      existing.related_entity_type === "release" ? existing.related_entity_id : null,
    payload: { ...payload, RETRY_OF: existing.id },
    idempotencyKey: `RETRY:${existing.id}:${Date.now()}`,
    createdBy: ctx.userId,
  });
  if (enq.error) return { ok: false, error: enq.error };
  if (enq.id) {
    try {
      await processEmailEvent(supabase, enq.id);
    } catch {
      /* queued */
    }
  }
  await supabase.rpc("write_audit_log", {
    p_action: "email_retry",
    p_entity_type: "email_outbound_event",
    p_entity_id: enq.id,
    p_metadata: { retry_of: existing.id, template_key: templateKey },
  });
  revalidateEmailAdmin();
  return { ok: true, data: { id: enq.id } };
}

export async function processQueuedEmailEventsAction(): Promise<
  ActionResult<{ processed: number }>
> {
  await RequireAdminPermission("admin:emails");
  const supabase = await createClient();
  const { processPendingBatch } = await import("@/lib/email/outbox");
  const result = await processPendingBatch(supabase, 25);
  revalidateEmailAdmin();
  return { ok: true, data: { processed: result.processed } };
}

export async function toggleEmailAutomationAction(
  key: string,
  enabled: boolean
): Promise<ActionResult<{ key: string; enabled: boolean }>> {
  await RequireAdminPermission("admin:emails");
  const supabase = await createClient();
  const { data: existing, error: loadError } = await supabase
    .from("email_automations")
    .select("key, hosted_by_supabase")
    .eq("key", key)
    .maybeSingle();
  if (loadError) return { ok: false, error: loadError.message };
  if (!existing) return { ok: false, error: "Automation not found. Apply the email_automations migration." };
  if (existing.hosted_by_supabase) {
    return { ok: false, error: "Auth templates are hosted by Supabase and cannot be toggled on the outbox." };
  }
  const { error } = await supabase
    .from("email_automations")
    .update({ enabled })
    .eq("key", key);
  if (error) return { ok: false, error: error.message };
  await supabase.rpc("write_audit_log", {
    p_action: "email_automation_toggle",
    p_entity_type: "email_automation",
    p_entity_id: null,
    p_metadata: { key, enabled },
  });
  revalidateEmailAdmin();
  return { ok: true, data: { key, enabled } };
}

export async function sendTestTemplateAction(input: {
  templateKey: string;
  to: string;
}): Promise<ActionResult<{ status: string }>> {
  const ctx = await RequireAdminPermission("admin:emails");
  const to = input.to.trim().toLowerCase();
  if (!to || !to.includes("@")) return { ok: false, error: "Enter a valid test recipient." };
  const templateKey = assertEnqueueableTemplateKey(input.templateKey);
  const supabase = await createClient();
  const enq = await enqueueEmailEvent(supabase, {
    eventType: "manual.send",
    templateKey,
    recipientEmail: to,
    payload: {
      FIRST_NAME: "Test",
      RELEASE_ID: "test-release-id",
      RELEASE_TITLE: "Test Release",
      RELEASE_TYPE: "Single",
      RELEASE_VERSION: "Original",
      ARTIST_NAME: "Test Artist",
      LABEL_NAME: "Test Label",
      UPC: "000000000000",
      RELEASE_DATE: "2026-09-15",
      ORIGINAL_RELEASE_DATE: "2026-09-15",
      GENRE: "Pop",
      SUBGENRE: "Pop",
      LANGUAGE: "English",
      EXPLICIT_LABEL: "Not explicit",
      TERRITORIES: "WW",
      COPYRIGHT_YEAR: "2026",
      COPYRIGHT_LINE: "© 2026 Test Artist",
      PHONOGRAM_LINE: "℗ 2026 Test Label",
      TRACK_COUNT: "1",
      TRACKS_SUMMARY: "1. Test Track — ISRC TEST00000001",
      RELEASE_STATUS: "approved",
      STATUS_LABEL: "Approved",
      REASON: "Test operational email reason",
      QC_NOTES: "Test operational email reason",
      DECISION_SUMMARY: "This is a test of the complete operational email payload.",
      CTA_URL: "https://nexomusicdistribution.com/dashboard/releases",
      CTA_LABEL: "Open workspace",
      PREHEADER: "Nexo test email",
    },
    idempotencyKey: `TEST:${templateKey}:${ctx.userId}:${Date.now()}`,
    createdBy: ctx.userId,
  });
  if (enq.error || !enq.id) return { ok: false, error: enq.error ?? "Could not enqueue test." };
  const processed = await processEmailEvent(supabase, enq.id);
  revalidateEmailAdmin();
  return { ok: true, data: { status: processed.status } };
}


