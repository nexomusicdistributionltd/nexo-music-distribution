import "server-only";

import fs from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NEXO_EMAIL_SHELL_PATH } from "@/lib/email/brand";
import { wrapWithEmailShell, fallbackBrandedHtml } from "@/lib/email/branded-html";
import { htmlToPlainText } from "@/lib/email/inbound-html";
import {
  DEFAULT_EMAIL_FROM,
  isZohoSmtpConfigured,
  sendViaZohoSmtp,
  type ZohoSmtpAttachment,
} from "@/lib/email/zoho-smtp";
import { canMarkOutboundSent } from "@/lib/email/status";
import { parseAddressList, uniqueAddresses } from "@/lib/email/addresses";
import { assertOutboundAttachment, MAX_ATTACHMENTS } from "@/lib/email/attachments";

export const ADMIN_COMPOSE_TEMPLATE_KEY = "ADMIN_COMPOSE";

export function wrapBrandedHtml(opts: {
  subject: string;
  bodyHtml: string;
  preheader?: string;
}): string {
  try {
    const shell = fs.readFileSync(
      path.join(process.cwd(), NEXO_EMAIL_SHELL_PATH),
      "utf8"
    );
    return wrapWithEmailShell(shell, {
      bodyHtml: opts.bodyHtml,
      preheader: opts.preheader ?? opts.subject,
      subject: opts.subject,
    });
  } catch {
    return fallbackBrandedHtml(opts);
  }
}

export type ComposeSendInput = {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  branded?: boolean;
  inReplyTo?: string;
  references?: string;
  attachments?: ZohoSmtpAttachment[];
  createdBy?: string | null;
};

/**
 * Compose → email_outbound_events → sendViaZohoSmtp only.
 * Never marks sent without provider + message id. No Resend.
 */
export async function sendComposedEmail(
  supabase: SupabaseClient,
  input: ComposeSendInput
): Promise<
  | { ok: true; eventId: string; status: "sent" | "queued" | "failed" | "skipped"; messageId?: string }
  | { ok: false; error: string }
> {
  const to = parseAddressList(input.to);
  const cc = parseAddressList(input.cc ?? "");
  const bcc = parseAddressList(input.bcc ?? "");
  if (to.length === 0) return { ok: false, error: "At least one valid To address is required." };
  const subject = input.subject.trim();
  if (!subject) return { ok: false, error: "Subject is required." };
  const bodyHtml = input.bodyHtml.trim();
  if (!bodyHtml) return { ok: false, error: "Body is required." };
  if (input.attachments && input.attachments.length > MAX_ATTACHMENTS) {
    return { ok: false, error: `At most ${MAX_ATTACHMENTS} attachments.` };
  }
  for (const att of input.attachments ?? []) {
    const check = assertOutboundAttachment({
      filename: att.filename,
      contentType: att.contentType,
      size: att.content.length,
    });
    if (!check.ok) return check;
  }

  const html = input.branded === false ? bodyHtml : wrapBrandedHtml({ subject, bodyHtml });
  const text = (input.bodyText ?? "").trim() || htmlToPlainText(html);
  const allRecipients = uniqueAddresses(to, cc, bcc);
  const primary = to[0];
  const from = (process.env.EMAIL_FROM ?? "").trim() || DEFAULT_EMAIL_FROM;

  const payload = {
    _event_type: input.inReplyTo ? "manual.reply" : "manual.compose",
    _idempotency_key: `ADMIN_COMPOSE:${crypto.randomUUID()}`,
    _created_by: input.createdBy ?? null,
    subject,
    html,
    text,
    to,
    cc,
    bcc,
    in_reply_to: input.inReplyTo ?? null,
    references: input.references ?? null,
    template_catalog_key: ADMIN_COMPOSE_TEMPLATE_KEY,
  };

  const { data: eventId, error: insertErr } = await supabase.rpc("admin_enqueue_composed_email", {
    p_to_email: primary,
    p_template_key: ADMIN_COMPOSE_TEMPLATE_KEY,
    p_payload: payload,
    p_related_entity_type: input.inReplyTo ? "email_reply" : "email_compose",
  });

  if (insertErr || !eventId) {
    return { ok: false, error: insertErr?.message ?? "Could not queue outbound event." };
  }
  const ev = { id: String(eventId) };

  if (!isZohoSmtpConfigured()) {
    await supabase
      .from("email_outbound_events")
      .update({
        status: "skipped",
        error: "Zoho SMTP not configured — not marked sent.",
      })
      .eq("id", ev.id);
    return { ok: true, eventId: ev.id, status: "skipped" };
  }

  await supabase
    .from("email_outbound_events")
    .update({ status: "pending" })
    .eq("id", ev.id);

  const result = await sendViaZohoSmtp({
    to,
    cc: cc.length ? cc : undefined,
    bcc: bcc.length ? bcc : undefined,
    subject,
    html,
    text,
    from,
    inReplyTo: input.inReplyTo,
    references: input.references,
    attachments: input.attachments,
  });

  if (!result.ok) {
    await supabase
      .from("email_outbound_events")
      .update({
        status: "failed",
        provider: "zoho-smtp",
        error: result.error,
      })
      .eq("id", ev.id);
    return { ok: true, eventId: ev.id, status: "failed" };
  }

  if (!canMarkOutboundSent("zoho-smtp", result.messageId)) {
    await supabase
      .from("email_outbound_events")
      .update({
        status: "failed",
        provider: "zoho-smtp",
        error: "SMTP accepted without a usable message id — not marking sent",
      })
      .eq("id", ev.id);
    return { ok: true, eventId: ev.id, status: "failed" };
  }

  const { error: sentErr } = await supabase
    .from("email_outbound_events")
    .update({
      status: "sent",
      provider: "zoho-smtp",
      provider_message_id: result.messageId,
      error: null,
      payload: { ...payload, recipients: allRecipients },
    })
    .eq("id", ev.id);

  if (sentErr) {
    return { ok: false, error: sentErr.message };
  }

  return { ok: true, eventId: ev.id, status: "sent", messageId: result.messageId };
}
