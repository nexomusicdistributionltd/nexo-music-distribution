"use server";

import { revalidatePath } from "next/cache";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  deliverErn,
  generateErnForRelease,
  validateStoredErn,
} from "@/lib/ddex/admin-ops";
import { publicErrorMessage } from "@/lib/http/safe-error";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function revalidateDdex(releaseId?: string) {
  revalidatePath("/admin/ddex");
  revalidatePath("/admin/releases");
  if (releaseId) {
    revalidatePath(`/admin/ddex/${releaseId}`);
    revalidatePath(`/admin/releases/${releaseId}`);
  }
}

export async function generateErnAction(releaseId: string): Promise<ActionResult> {
  const ctx = await RequireAdminPermission("admin:ddex");
  try {
    const res = await generateErnForRelease(releaseId);
    const supabase = await createClient();
    await supabase.rpc("write_audit_log", {
      p_action: "ddex_generate",
      p_entity_type: "release",
      p_entity_id: releaseId,
      p_metadata: { ok: res.ok, actor: ctx.userId },
    });
    revalidateDdex(releaseId);
    if (!res.ok) return { ok: false, error: publicErrorMessage(res.error) };
    return {
      ok: true,
      data: {
        messageId: res.message.message_id,
        filename: res.filename,
        xmlSha256: res.xmlSha256,
        validationStatus: res.message.validation_status,
      },
    };
  } catch (e) {
    return { ok: false, error: publicErrorMessage(e) };
  }
}

export async function validateErnAction(messageId: string, releaseId?: string): Promise<ActionResult> {
  const ctx = await RequireAdminPermission("admin:ddex");
  try {
    const res = await validateStoredErn(messageId);
    const supabase = await createClient();
    await supabase.rpc("write_audit_log", {
      p_action: "ddex_validate",
      p_entity_type: "ddex_message",
      p_entity_id: null,
      p_metadata: { messageId, ok: res.ok, actor: ctx.userId },
    });
    revalidateDdex(releaseId);
    if (!res.ok) return { ok: false, error: publicErrorMessage(res.error) };
    return { ok: true, data: { messageId: res.messageId } };
  } catch (e) {
    return { ok: false, error: publicErrorMessage(e) };
  }
}

export async function deliverErnAction(messageId: string): Promise<ActionResult> {
  await RequireAdminPermission("admin:ddex");
  const res = await deliverErn(messageId);
  return { ok: false, error: publicErrorMessage(res.error) };
}
