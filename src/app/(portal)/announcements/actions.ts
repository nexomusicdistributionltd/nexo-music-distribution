"use server";

import { revalidatePath } from "next/cache";
import { RequireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export async function markAnnouncementReadAction(formData: FormData) {
  const ctx = await RequireAuth({ redirectTo: "/login" });
  const id = String(formData.get("announcement_id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const supabase = await createClient();
  await supabase.from("admin_announcement_reads").upsert({
    announcement_id: id,
    user_id: ctx.userId,
    read_at: new Date().toISOString(),
  });
  revalidatePath("/dashboard");
}
