"use server";

import { revalidatePath } from "next/cache";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { canStaffTransitionPitch, isPlaylistPitchStatus } from "@/lib/playlist-pitch/status";

export async function reviewPlaylistPitchAction(input: {
  id: string;
  status: string;
  adminNote?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await RequireAdminPermission("admin:marketing");
  if (!isPlaylistPitchStatus(input.status)) return { ok: false, error: "Invalid status." };
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("playlist_pitch_requests")
    .select("id, status")
    .eq("id", input.id)
    .maybeSingle();
  if (!row || !isPlaylistPitchStatus(row.status)) return { ok: false, error: "Pitch not found." };
  if (!canStaffTransitionPitch(row.status, input.status)) {
    return { ok: false, error: `Cannot move from ${row.status} to ${input.status}.` };
  }
  const { error } = await supabase
    .from("playlist_pitch_requests")
    .update({
      status: input.status,
      admin_note: input.adminNote?.trim() || null,
      reviewed_by: ctx.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  try {
    await supabase.rpc("write_audit_log", {
      p_action: "playlist_pitch_review",
      p_entity_type: "playlist_pitch",
      p_entity_id: input.id,
      p_metadata: { status: input.status },
    });
  } catch {
    /* ignore */
  }
  revalidatePath("/admin/playlist-pitches");
  return { ok: true };
}
