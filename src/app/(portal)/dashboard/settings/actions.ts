"use server";

import { revalidatePath } from "next/cache";
import { RequireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

const SETTINGS_ALLOWLIST = [
  "timezone",
  "language",
  "full_name",
  "display_name",
  "country",
] as const;

export async function updateSettings(input: {
  timezone?: string | null;
  language?: string | null;
  full_name?: string;
  display_name?: string;
  country?: string | null;
}) {
  const ctx = await RequireAuth();
  const supabase = await createClient();
  const raw = input as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const key of SETTINGS_ALLOWLIST) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const value = raw[key];
    if (key === "full_name" || key === "display_name") {
      patch[key] = typeof value === "string" ? value.trim() : "";
    } else {
      patch[key] = value ? value : null;
    }
  }

  // Never allow privilege fields through this action
  delete patch.account_type;
  delete patch.account_status;
  delete patch.id;
  delete patch.email;

  if (Object.keys(patch).length === 0) {
    return { ok: false as const, error: "No valid fields to update." };
  }

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
