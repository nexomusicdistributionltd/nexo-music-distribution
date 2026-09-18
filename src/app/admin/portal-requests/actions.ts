"use server";

import { revalidatePath } from "next/cache";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/admin";

const SERVICE_STATUSES = new Set(["submitted", "reviewing", "accepted", "rejected"]);
const VIDEO_STATUSES = new Set(["submitted", "reviewing", "accepted", "rejected"]);

async function notifyUser(input: {
  userId: string;
  title: string;
  body: string;
  entityType: string;
  entityId: string;
}) {
  const db = createServiceClient();
  await db.from("notifications").insert({
    user_id: input.userId,
    type: "system",
    title: input.title,
    body: input.body,
    entity_type: input.entityType,
    entity_id: input.entityId,
  });
}

export async function updatePortalServiceRequestAction(input: {
  id: string;
  status: string;
  adminNote?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await RequireAdminPermission("admin:support");
  if (!SERVICE_STATUSES.has(input.status)) return { ok: false, error: "Invalid request status." };

  const db = createServiceClient();
  const { data: current, error: readError } = await db
    .from("portal_service_requests")
    .select("id,owner_user_id,title,kind")
    .eq("id", input.id)
    .maybeSingle();
  if (readError || !current) return { ok: false, error: "Service request not found." };

  const { error } = await db
    .from("portal_service_requests")
    .update({
      status: input.status,
      admin_note: input.adminNote?.trim().slice(0, 4000) || null,
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  await notifyUser({
    userId: current.owner_user_id,
    title: `${current.title} · ${input.status.replace(/_/g, " ")}`,
    body: input.adminNote?.trim() || `Your Nexo ${String(current.kind).replace(/_/g, " ")} request was updated.`,
    entityType: "portal_service_request",
    entityId: current.id,
  });

  revalidatePath("/admin/portal-requests");
  return { ok: true };
}

export async function updateMusicVideoRequestAction(input: {
  id: string;
  status: string;
  adminNote?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await RequireAdminPermission("admin:support");
  if (!VIDEO_STATUSES.has(input.status)) return { ok: false, error: "Invalid video status." };

  const db = createServiceClient();
  const { data: current, error: readError } = await db
    .from("music_video_submissions")
    .select("id,owner_user_id,title")
    .eq("id", input.id)
    .maybeSingle();
  if (readError || !current) return { ok: false, error: "Music video request not found." };

  const { error } = await db
    .from("music_video_submissions")
    .update({
      status: input.status,
      admin_note: input.adminNote?.trim().slice(0, 4000) || null,
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  await notifyUser({
    userId: current.owner_user_id,
    title: `${current.title} · ${input.status.replace(/_/g, " ")}`,
    body: input.adminNote?.trim() || "Your Nexo music-video request was updated.",
    entityType: "music_video_submission",
    entityId: current.id,
  });

  void ctx;
  revalidatePath("/admin/portal-requests");
  return { ok: true };
}
