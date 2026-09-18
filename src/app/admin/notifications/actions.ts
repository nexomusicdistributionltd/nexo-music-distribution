"use server";

import { revalidatePath } from "next/cache";
import { RequireAdministrator } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export async function sendBroadcastNotificationAction(input: {
  title: string;
  body: string;
  audience: "all" | "artists" | "labels";
}): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  await RequireAdministrator();
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

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_notification_broadcast", {
    p_title: title,
    p_body: body,
    p_audience: input.audience,
  });

  if (error) {
    return {
      ok: false,
      error:
        error.code === "42501"
          ? "Administrator permission required."
          : "Could not publish the notification broadcast.",
    };
  }

  const result =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};

  revalidatePath("/admin/notifications");
  revalidatePath("/dashboard/notifications");
  return {
    ok: true,
    count: Number(result.recipient_count ?? 0),
  };
}
