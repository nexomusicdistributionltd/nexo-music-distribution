"use server";

import { revalidatePath } from "next/cache";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  buildDdexPackage,
  deliverErn,
  generateErnForRelease,
  generateDdexTakedown,
  generateDdexUpdate,
  getErnDownload,
  processDdexAcknowledgment,
  queueDdexDelivery,
  retryDdexDelivery,
  validateReleaseForDdex,
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

async function audit(action: string, entityId: string | null, metadata: Record<string, unknown>) {
  const supabase = await createClient();
  await supabase.rpc("write_audit_log", {
    p_action: action,
    p_entity_type: entityId ? "release" : "ddex_message",
    p_entity_id: null,
    p_metadata: metadata,
  });
}

export async function generateErnAction(releaseId: string, targetId?: string): Promise<ActionResult> {
  const ctx = await RequireAdminPermission("admin:ddex");
  try {
    const res = await generateErnForRelease(releaseId, targetId);
    await audit("ddex_generate", releaseId, { ok: res.ok, actor: ctx.userId, targetId: targetId ?? null });
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

export async function validateReleaseAction(releaseId: string, targetId?: string): Promise<ActionResult> {
  const ctx = await RequireAdminPermission("admin:ddex");
  try {
    const res = await validateReleaseForDdex(releaseId, targetId);
    await audit("ddex_validate", releaseId, { ok: res.ok, actor: ctx.userId });
    revalidateDdex(releaseId);
    if (!res.ok) return { ok: false, error: publicErrorMessage(res.error) };
    return {
      ok: true,
      data: {
        canGenerate: res.report.canGenerate,
        errors: res.report.errors,
        nexoStatus: res.report.nexoStatus,
        dspStatus: res.report.dspStatus,
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
    await audit("ddex_validate", null, { messageId, ok: res.ok, actor: ctx.userId });
    revalidateDdex(releaseId);
    if (!res.ok) return { ok: false, error: publicErrorMessage(res.error) };
    return { ok: true, data: { messageId: res.messageId } };
  } catch (e) {
    return { ok: false, error: publicErrorMessage(e) };
  }
}

export async function previewErnAction(messageId: string): Promise<ActionResult<{ xml: string; filename: string }>> {
  await RequireAdminPermission("admin:ddex");
  const res = await getErnDownload(messageId);
  if (!res.ok) return { ok: false, error: publicErrorMessage(res.error) };
  return { ok: true, data: { xml: res.xml, filename: res.filename } };
}

export async function packageErnAction(messageId: string, releaseId?: string): Promise<ActionResult> {
  const ctx = await RequireAdminPermission("admin:ddex");
  try {
    const res = await buildDdexPackage(messageId);
    await audit("ddex_package", releaseId ?? null, { messageId, ok: res.ok, actor: ctx.userId });
    revalidateDdex(releaseId);
    if (!res.ok) return { ok: false, error: publicErrorMessage(res.error) };
    return { ok: true, data: { packageSha256: res.packageSha256 } };
  } catch (e) {
    return { ok: false, error: publicErrorMessage(e) };
  }
}

export async function queueErnAction(messageId: string, releaseId?: string): Promise<ActionResult> {
  const ctx = await RequireAdminPermission("admin:ddex");
  try {
    const res = await queueDdexDelivery(messageId);
    await audit("ddex_queue", releaseId ?? null, { messageId, ok: res.ok, actor: ctx.userId });
    revalidateDdex(releaseId);
    if (!res.ok) return { ok: false, error: publicErrorMessage(res.error) };
    return { ok: true, data: { idempotent: res.idempotent } };
  } catch (e) {
    return { ok: false, error: publicErrorMessage(e) };
  }
}

export async function deliverErnAction(messageId: string, releaseId?: string): Promise<ActionResult> {
  const ctx = await RequireAdminPermission("admin:ddex");
  const res = await deliverErn(messageId);
  await audit("ddex_deliver", releaseId ?? null, { messageId, ok: res.ok, actor: ctx.userId });
  revalidateDdex(releaseId);
  if (!res.ok) return { ok: false, error: publicErrorMessage(res.error) };
  return { ok: true, data: { delivered: true } };
}

export async function retryErnAction(messageId: string, releaseId?: string): Promise<ActionResult> {
  const ctx = await RequireAdminPermission("admin:ddex");
  try {
    const res = await retryDdexDelivery(messageId);
    await audit("ddex_retry", releaseId ?? null, { messageId, ok: res.ok, actor: ctx.userId });
    revalidateDdex(releaseId);
    if (!res.ok) return { ok: false, error: publicErrorMessage(res.error) };
    return { ok: true, data: { retried: true } };
  } catch (e) {
    return { ok: false, error: publicErrorMessage(e) };
  }
}

export async function ackErnAction(
  messageId: string,
  reference: string,
  releaseId?: string
): Promise<ActionResult> {
  const ctx = await RequireAdminPermission("admin:ddex");
  try {
    const res = await processDdexAcknowledgment(messageId, reference);
    await audit("ddex_ack", releaseId ?? null, { messageId, ok: res.ok, actor: ctx.userId });
    revalidateDdex(releaseId);
    if (!res.ok) return { ok: false, error: publicErrorMessage(res.error) };
    return { ok: true, data: { acknowledged: true } };
  } catch (e) {
    return { ok: false, error: publicErrorMessage(e) };
  }
}

export async function updateErnAction(releaseId: string, targetId?: string): Promise<ActionResult> {
  const ctx = await RequireAdminPermission("admin:ddex");
  try {
    const res = await generateDdexUpdate(releaseId, targetId);
    await audit("ddex_update", releaseId, { ok: res.ok, actor: ctx.userId });
    revalidateDdex(releaseId);
    if (!res.ok) return { ok: false, error: publicErrorMessage(res.error) };
    return { ok: true, data: { messageId: res.record.message_id } };
  } catch (e) {
    return { ok: false, error: publicErrorMessage(e) };
  }
}

export async function takedownErnAction(releaseId: string, targetId?: string): Promise<ActionResult> {
  const ctx = await RequireAdminPermission("admin:ddex");
  try {
    const res = await generateDdexTakedown(releaseId, targetId);
    await audit("ddex_takedown", releaseId, { ok: res.ok, actor: ctx.userId });
    revalidateDdex(releaseId);
    if (!res.ok) return { ok: false, error: publicErrorMessage(res.error) };
    return { ok: true, data: { messageId: res.record.message_id } };
  } catch (e) {
    return { ok: false, error: publicErrorMessage(e) };
  }
}
