"use server";

import { revalidatePath } from "next/cache";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/admin";

export async function savePortalFeatureControlAction(input: {
  href: string;
  label: string;
  enabledArtist: boolean;
  enabledLabel: boolean;
  adminNote?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await RequireAdminPermission("admin:settings");
  const href = input.href.trim();
  const label = input.label.trim();
  if (!href.startsWith("/") || href.length > 300) return { ok: false, error: "Valid portal route required." };
  if (!label || label.length > 120) return { ok: false, error: "Feature label required." };

  const db = createServiceClient();
  const { error } = await db.from("portal_feature_controls").upsert({
    href,
    label,
    enabled_artist: input.enabledArtist,
    enabled_label: input.enabledLabel,
    admin_note: input.adminNote?.trim().slice(0, 1000) || null,
    updated_by: ctx.userId,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/portal-features");
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
