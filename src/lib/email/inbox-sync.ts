import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchRecentInboxMessages } from "@/lib/email/zoho-imap";
import { EMAIL_ATTACHMENTS_BUCKET } from "@/lib/email/attachments";

/**
 * Persist IMAP fetch into email_inbox_messages.
 * Never copies rows from email_outbound_events (that is sent history, not inbox).
 */
export async function syncZohoInbox(
  supabase: SupabaseClient,
  opts?: { limit?: number; folder?: string }
): Promise<{ ok: true; upserted: number } | { ok: false; error: string }> {
  const fetched = await fetchRecentInboxMessages({
    limit: opts?.limit,
    folder: opts?.folder,
  });
  if (!fetched.ok) return fetched;

  let upserted = 0;
  for (const msg of fetched.messages) {
    if (!msg.uid) continue;
    const { data: row, error } = await supabase
      .from("email_inbox_messages")
      .upsert(
        {
          folder: msg.folder,
          uid: msg.uid,
          message_id: msg.messageId,
          in_reply_to: msg.inReplyTo,
          references_header: msg.references,
          thread_key: msg.threadKey || msg.messageId || `${msg.folder}:${msg.uid}`,
          from_email: msg.fromEmail || "unknown@invalid",
          from_name: msg.fromName,
          to_emails: msg.toEmails,
          cc_emails: msg.ccEmails,
          bcc_emails: msg.bccEmails,
          subject: msg.subject,
          sent_at: msg.date,
          seen: msg.seen,
          text_body: msg.textBody,
          html_body: msg.htmlBodySanitized,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "folder,uid" }
      )
      .select("id")
      .single();
    if (error || !row) {
      return { ok: false, error: error?.message ?? "Inbox upsert failed" };
    }
    upserted += 1;

    if (msg.attachments.length === 0) continue;

    await supabase.from("email_inbox_attachments").delete().eq("message_id", row.id);

    for (const att of msg.attachments) {
      const sha = att.content
        ? createHash("sha256").update(att.content).digest("hex")
        : null;
      let storagePath: string | null = null;
      if (att.trusted && att.content && att.content.length > 0) {
        storagePath = `${row.id}/${sha ?? att.filename}`;
        const { error: upErr } = await supabase.storage
          .from(EMAIL_ATTACHMENTS_BUCKET)
          .upload(storagePath, att.content, {
            contentType: att.contentType,
            upsert: true,
          });
        if (upErr) storagePath = null;
      }
      await supabase.from("email_inbox_attachments").insert({
        message_id: row.id,
        filename: att.filename,
        content_type: att.contentType,
        byte_size: att.size,
        sha256: sha,
        trusted: att.trusted && Boolean(storagePath),
        storage_bucket: storagePath ? EMAIL_ATTACHMENTS_BUCKET : null,
        storage_path: storagePath,
      });
    }
  }

  return { ok: true, upserted };
}
