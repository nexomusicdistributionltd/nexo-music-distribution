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
import { resolveManualRecipients } from "@/lib/email/resolve-recipient";
import type { StoredTemplateCategory } from "@/lib/email/types";
import type { ActionResult } from "@/app/admin/actions";

function revalidateEmailAdmin() {
  revalidatePath("/admin/emails");
  revalidatePath("/admin/emails/templates");
  revalidatePath("/admin/emails/send");
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
  userIds: string[];
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
  if (!input.selectAll && selectedIds.length === 0) {
    return { ok: false, error: "Select at least one user, or choose Select all users." };
  }

  let resolved: Awaited<ReturnType<typeof resolveManualRecipients>>;
  try {
    resolved = await resolveManualRecipients(supabase, {
      selectAll: input.selectAll,
      userIds: selectedIds,
      limit: MANUAL_SEND_MAX_RECIPIENTS,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to resolve recipients." };
  }

  if (resolved.recipients.length === 0) {
    return { ok: false, error: "No recipients with a profile email were found." };
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
    if (!recipient.userId) continue;
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
      },
      idempotencyKey: campaignIdempotencyKey(campaignId, recipient.userId),
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
