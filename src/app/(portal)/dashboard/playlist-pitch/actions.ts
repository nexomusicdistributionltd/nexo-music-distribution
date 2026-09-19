"use server";

import { revalidatePath } from "next/cache";
import { RequireVerifiedPortal, assertCanMutateCatalog } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { canOwnerTransitionPitch, isPlaylistPitchStatus } from "@/lib/playlist-pitch/status";
import { parseHttpUrl } from "@/lib/dsp/profile-links";
import { hasAcceptedRequiredPolicies, isFeatureEnabled } from "@/lib/admin/feature-flags";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function requirePortal() {
  return RequireVerifiedPortal();
}

export async function createPlaylistPitch(input: {
  playlist_name: string;
  playlist_url?: string;
  pitch_note?: string;
  release_id?: string;
  artist_profile_id?: string;
}): Promise<ActionResult<{ id: string }>> {
  const ctx = await requirePortal();
  if (!(await hasAcceptedRequiredPolicies(ctx.userId))) {
    return { ok: false, error: "Review and accept the current Nexo policies in Account → Policies & Agreements before using Playlist Pitching." };
  }
  if (!(await isFeatureEnabled("playlist_pitching", true))) {
    return { ok: false, error: "Playlist pitching is temporarily paused by Nexo operations." };
  }
  try {
    assertCanMutateCatalog(ctx);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restricted." };
  }
  const name = input.playlist_name.trim();
  if (!name) return { ok: false, error: "Playlist name is required." };
  const url = (input.playlist_url ?? "").trim();
  if (url && !parseHttpUrl(url)) return { ok: false, error: "Playlist URL must be http(s)." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("playlist_pitch_requests")
    .insert({
      owner_user_id: ctx.userId,
      playlist_name: name,
      playlist_url: url || null,
      pitch_note: input.pitch_note?.trim() || null,
      release_id: input.release_id || null,
      artist_profile_id: input.artist_profile_id || null,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  try {
    await supabase.rpc("write_audit_log", {
      p_action: "playlist_pitch_create",
      p_entity_type: "playlist_pitch",
      p_entity_id: data.id,
      p_metadata: { playlist_name: name },
    });
  } catch {
    /* ignore */
  }
  revalidatePath("/dashboard/playlist-pitch");
  return { ok: true, data: { id: data.id } };
}

export async function submitPlaylistPitch(id: string): Promise<ActionResult> {
  const ctx = await requirePortal();
  if (!(await isFeatureEnabled("playlist_pitching", true))) {
    return { ok: false, error: "Playlist pitching is temporarily paused by Nexo operations." };
  }
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("playlist_pitch_requests")
    .select("id, status")
    .eq("id", id)
    .eq("owner_user_id", ctx.userId)
    .maybeSingle();
  if (!row) return { ok: false, error: "Pitch not found." };
  if (!isPlaylistPitchStatus(row.status) || !canOwnerTransitionPitch(row.status, "submitted")) {
    return { ok: false, error: "Cannot submit this pitch." };
  }
  const { error } = await supabase
    .from("playlist_pitch_requests")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq("id", id)
    .eq("owner_user_id", ctx.userId);
  if (error) return { ok: false, error: error.message };
  try {
    await supabase.rpc("write_audit_log", {
      p_action: "playlist_pitch_submit",
      p_entity_type: "playlist_pitch",
      p_entity_id: id,
      p_metadata: {},
    });
  } catch {
    /* ignore */
  }
  revalidatePath("/dashboard/playlist-pitch");
  return { ok: true, data: true };
}
