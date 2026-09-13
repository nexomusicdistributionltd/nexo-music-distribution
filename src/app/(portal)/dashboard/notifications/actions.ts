"use server";

import { revalidatePath } from "next/cache";
import { RequireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationRead(id: string) {
  const ctx = await RequireAuth();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .is("read_at", null);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function markAllNotificationsRead() {
  const ctx = await RequireAuth();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", ctx.userId)
    .is("read_at", null);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
  return { ok: true as const };
}
