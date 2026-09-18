"use server";

import { revalidatePath } from "next/cache";
import { RequireAdministrator } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/admin";

export async function sendBroadcastNotificationAction(input: {
  title: string;
  body: string;
  audience: "all" | "artists" | "labels";
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const ctx = await RequireAdministrator();
  const title = input.title.trim();
  const body = input.body.trim();

  if (title.length < 2 || title.length > 160) {
    return { ok: false, error: "Title must be 2–160 characters." };
  }
  if (body.length < 2 || body.length > 20000) {
    return { ok: false, error: "Message must be 2–20,000 characters." };
  }
  if (!["all", "artists", "labels"].includes(input.audience)) {
    return { ok: false, error: "Select a valid audience." };
  }

  const service = createServiceClient();
  const { data: broadcast, error: broadcastError } = await service
    .from("notification_broadcasts")
    .insert({
      title,
      body,
      audience: input.audience,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (broadcastError || !broadcast) {
    return { ok: false, error: "Could not create the broadcast." };
  }

  let recipientsQuery = service
    .from("profiles")
    .select("id,account_type")
    .in("account_status", ["active", "pending_verification"]);

  if (input.audience === "artists") {
    recipientsQuery = recipientsQuery.eq("account_type", "artist");
  } else if (input.audience === "labels") {
    recipientsQuery = recipientsQuery.eq("account_type", "label");
  } else {
    recipientsQuery = recipientsQuery.in("account_type", ["artist", "label"]);
  }

  const { data: recipients, error: recipientError } = await recipientsQuery;
  if (recipientError) {
    return { ok: false, error: "Broadcast created, but recipients could not be resolved." };
  }

  const rows = (recipients ?? []).map((profile) => ({
    user_id: profile.id,
    type: "broadcast",
    title,
    body,
    entity_type: "notification_broadcast",
    entity_id: broadcast.id,
  }));

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await service.from("notifications").insert(rows.slice(i, i + 500));
    if (error) {
      return {
        ok: false,
        error: "Broadcast created, but delivery to every account could not be completed.",
      };
    }
  }

  await service
    .from("notification_broadcasts")
    .update({
      recipient_count: rows.length,
      published_at: new Date().toISOString(),
    })
    .eq("id", broadcast.id);

  revalidatePath("/admin/notifications");
  revalidatePath("/dashboard/notifications");
  return { ok: true, count: rows.length };
}
