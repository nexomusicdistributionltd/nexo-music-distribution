"use server";

import { revalidatePath } from "next/cache";
import { RequireAdministrator } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/admin";

export async function sendBroadcastNotificationAction(input: {
  title: string;
  body: string;
  audience: "all" | "artists" | "labels";
  actionPath?: string | null;
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const ctx = await RequireAdministrator();
  const title = input.title.trim();
  const body = input.body.trim();
  const actionPath = input.actionPath?.trim() || null;
  if (title.length < 2 || title.length > 160) return { ok: false, error: "Title must be 2–160 characters." };
  if (body.length < 2 || body.length > 12000) return { ok: false, error: "Message must be 2–12,000 characters." };
  if (actionPath && (!actionPath.startsWith("/") || actionPath.startsWith("//"))) {
    return { ok: false, error: "Action path must be an internal Nexo path beginning with /." };
  }

  const service = createServiceClient();
  const { data: broadcast, error: broadcastError } = await service
    .from("notification_broadcasts")
    .insert({
      title,
      body,
      audience: input.audience,
      action_path: actionPath,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (broadcastError || !broadcast) return { ok: false, error: "Could not create broadcast." };

  let query = service.from("profiles").select("id,account_type");
  if (input.audience === "artists") query = query.eq("account_type", "artist");
  else if (input.audience === "labels") query = query.eq("account_type", "label");
  else query = query.in("account_type", ["artist", "label"]);

  const { data: recipients, error: recipientsError } = await query;
  if (recipientsError) return { ok: false, error: "Could not resolve broadcast recipients." };

  const rows = (recipients ?? []).map((profile) => {
    const id = crypto.randomUUID();
    return {
      id,
      user_id: profile.id,
      type: "broadcast",
      title,
      body,
      entity_type: "notification_broadcast",
      entity_id: broadcast.id,
      action_path: actionPath || `/dashboard/notifications/${id}`,
    };
  });

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await service.from("notifications").insert(rows.slice(i, i + 500));
    if (error) return { ok: false, error: "Broadcast was created but recipient delivery could not be completed." };
  }

  await service
    .from("notification_broadcasts")
    .update({ recipient_count: rows.length })
    .eq("id", broadcast.id);

  revalidatePath("/admin/notifications");
  revalidatePath("/dashboard/notifications");
  return { ok: true, count: rows.length };
}
