"use server";

import { revalidatePath } from "next/cache";
import { RequireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { sanitizeFilename } from "@/lib/storage/release-assets";
import { enqueueEmailEvent } from "@/lib/email/enqueue";
import { resolveProfileRecipient } from "@/lib/email/resolve-recipient";

export type SupportActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

async function requirePortalUser() {
  return RequireRole(["artist", "label"]);
}

export async function createSupportTicket(input: {
  subject: string;
  body: string;
}): Promise<SupportActionResult> {
  const ctx = await requirePortalUser();
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (subject.length < 3 || subject.length > 300) {
    return { ok: false, error: "Subject must be 3–300 characters." };
  }
  if (body.length < 3 || body.length > 10000) {
    return { ok: false, error: "Message must be 3–10,000 characters." };
  }

  const supabase = await createClient();
  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({ requester_user_id: ctx.userId, subject })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const { error: messageError } = await supabase.from("support_messages").insert({
    ticket_id: ticket.id,
    author_user_id: ctx.userId,
    body,
    is_internal: false,
  });
  if (messageError) return { ok: false, error: messageError.message };

  try {
    const recipient = await resolveProfileRecipient(supabase, ctx.userId);
    if (recipient && ticket?.id) {
      await enqueueEmailEvent(supabase, {
        eventType: "support",
        templateKey: "SUPPORT_TICKET_CREATED",
        recipientUserId: recipient.userId,
        recipientEmail: recipient.email,
        relatedEntityType: "support_ticket",
        relatedEntityId: ticket.id,
        payload: { FIRST_NAME: recipient.displayName ?? "", STATUS: "open" },
        idempotencyKey: `SUPPORT_TICKET_CREATED:${ticket.id}:app`,
        createdBy: ctx.userId,
      });
    }
  } catch {
    /* non-fatal; DB trigger also enqueues */
  }

  revalidatePath("/support");
  revalidatePath("/admin/support");
  return { ok: true, id: ticket.id };
}

export async function replySupportTicket(
  ticketId: string,
  formData: FormData
): Promise<SupportActionResult> {
  const ctx = await requirePortalUser();
  const body = String(formData.get("body") || "").trim();
  const fileValue = formData.get("attachment");
  const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
  if (body.length < 1 || body.length > 10000) {
    return { ok: false, error: "Message must be 1–10,000 characters." };
  }

  const supabase = await createClient();
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id")
    .eq("id", ticketId)
    .eq("requester_user_id", ctx.userId)
    .maybeSingle();
  if (!ticket) return { ok: false, error: "Ticket not found." };

  const { data: message, error } = await supabase
    .from("support_messages")
    .insert({
      ticket_id: ticketId,
      author_user_id: ctx.userId,
      body,
      is_internal: false,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  if (file) {
    const allowed = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "text/plain",
    ]);
    if (!allowed.has(file.type) || file.size > 25 * 1024 * 1024) {
      return { ok: false, error: "Attachment must be PDF, image, or text up to 25MB." };
    }
    const path = `${ctx.userId}/${ticketId}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("support-attachments")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) return { ok: false, error: uploadError.message };

    const { error: assetError } = await supabase.from("support_attachments").insert({
      message_id: message.id,
      storage_bucket: "support-attachments",
      storage_path: path,
      filename: sanitizeFilename(file.name),
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: ctx.userId,
    });
    if (assetError) return { ok: false, error: assetError.message };
  }

  revalidatePath("/support");
  revalidatePath("/admin/support");
  return { ok: true, id: ticketId };
}
