"use server";

import { revalidatePath } from "next/cache";
import { RequireAdministrator } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export async function createNotificationBroadcastAction(input: {
  title: string;
  body: string;
  audience: "all" | "artists" | "labels";
  publishNow?: boolean;
}): Promise<
  | { ok: true; data: { id: string; recipientCount: number } }
  | { ok: false; error: string }
> {
  const ctx = await RequireAdministrator();
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < 2 || title.length > 160) {
    return { ok: false, error: "Broadcast title must be 2–160 characters." };
  }
  if (body.length < 2 || body.length > 20000) {
    return { ok: false, error: "Broadcast message must be 2–20,000 characters." };
  }
  if (!["all", "artists", "labels"].includes(input.audience)) {
    return { ok: false, error: "Select a valid audience." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_broadcasts")
    .insert({
      title,
      body,
      audience: input.audience,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message || "Could not create broadcast." };

  let recipientCount = 0;
  if (input.publishNow !== false) {
    const { data: count, error: publishError } = await supabase.rpc(
      "publish_notification_broadcast_admin",
      { p_broadcast_id: data.id }
    );
    if (publishError) return { ok: false, error: publishError.message };
    recipientCount = Number(count || 0);
  }

  revalidatePath("/admin/notifications");
  revalidatePath("/dashboard/notifications");
  return { ok: true, data: { id: data.id, recipientCount } };
}

export async function publishNotificationBroadcastAction(
  id: string
): Promise<{ ok: true; data: { recipientCount: number } } | { ok: false; error: string }> {
  await RequireAdministrator();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_notification_broadcast_admin", {
    p_broadcast_id: id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/notifications");
  revalidatePath("/dashboard/notifications");
  return { ok: true, data: { recipientCount: Number(data || 0) } };
}
