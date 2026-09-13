"use server";

import { revalidatePath } from "next/cache";
import { RequireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export async function updateSettings(input: {
  timezone?: string | null;
  language?: string | null;
  full_name?: string;
  display_name?: string;
  country?: string | null;
}) {
  const ctx = await RequireAuth();
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.timezone !== undefined) patch.timezone = input.timezone || null;
  if (input.language !== undefined) patch.language = input.language || null;
  if (input.full_name !== undefined) patch.full_name = input.full_name.trim();
  if (input.display_name !== undefined) patch.display_name = input.display_name.trim();
  if (input.country !== undefined) patch.country = input.country || null;

  const { error } = await supabase.from("profiles").update(patch).eq("id", ctx.userId);
  if (error) return { ok: false as const, error: error.message };

  try {
    await supabase.rpc("write_audit_log", {
      p_action: "profile_update",
      p_entity_type: "profile",
      p_entity_id: ctx.userId,
      p_metadata: { fields: Object.keys(patch) },
    });
  } catch {
    /* ignore */
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/profile");
  revalidatePath("/profile");
  return { ok: true as const };
}
