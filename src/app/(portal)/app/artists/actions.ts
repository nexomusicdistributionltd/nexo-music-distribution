"use server";

import { revalidatePath } from "next/cache";
import { RequireVerifiedPortal, assertCanMutateCatalog } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { RosterArtistInput } from "@/lib/roster/types";
import { DSP_PROFILE_SPECS, validateDspProfileUrl, type DspProfileKey } from "@/lib/dsp/profile-links";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Create a label-managed roster artist.
 * CRITICAL invariants (enforced here + RLS):
 * - Inserts artist_profiles with user_id=NULL, profile_id=NULL
 * - Does NOT create auth.users
 * - Does NOT insert user_roles (no artist role for the Label user)
 * - Does NOT mutate profiles.account_type (Label stays Label)
 */
export async function createRosterArtist(
  input: RosterArtistInput,
  dspLinks: Array<{ dspKey: DspProfileKey; url: string; enabled: boolean }> = []
): Promise<ActionResult<{ id: string }>> {
  const ctx = await RequireVerifiedPortal();
  if (!ctx.roles.includes("label")) return { ok: false, error: "Label role required." };
  try {
    assertCanMutateCatalog(ctx);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restricted." };
  }

  const stage = input.stage_name?.trim();
  if (!stage) return { ok: false, error: "Stage / display name is required." };

  const validatedDspLinks: Array<{
    artist_profile_id?: string;
    dsp_key: DspProfileKey;
    url: string | null;
    enabled: boolean;
    verification_status: "unverified";
    verified_at: null;
    fetched_at: null;
  }> = [];
  for (const spec of DSP_PROFILE_SPECS) {
    const row = dspLinks.find((l) => l.dspKey === spec.key);
    const check = validateDspProfileUrl(spec.key, row?.url ?? "");
    if (!check.ok) return { ok: false, error: check.error };
    validatedDspLinks.push({
      dsp_key: spec.key,
      url: check.url,
      enabled: Boolean(row?.enabled && check.url),
      verification_status: "unverified",
      verified_at: null,
      fetched_at: null,
    });
  }

  const supabase = await createClient();
  const { data: label } = await supabase
    .from("label_profiles")
    .select("id")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!label) return { ok: false, error: "Label profile not found." };

  const genres = (input.genres ?? []).map((g) => g.trim()).filter(Boolean);
  const { data: artistId, error } = await supabase.rpc("create_label_roster_artist", {
    p_stage_name: stage,
    p_bio: input.bio?.trim() || null,
    p_country: input.country?.trim() || null,
    p_genres: genres,
    p_avatar_url: input.avatar_url?.trim() || null,
    p_website: input.website?.trim() || null,
  });
  if (error || !artistId) {
    return { ok: false, error: error?.message ?? "Could not create roster artist." };
  }
  const artist = { id: String(artistId) };

  if (validatedDspLinks.length > 0) {
    const payload = validatedDspLinks.map((row) => ({
      ...row,
      artist_profile_id: artist.id,
    }));
    const { error: dspError } = await supabase
      .from("artist_dsp_links")
      .upsert(payload, { onConflict: "artist_profile_id,dsp_key" });
    if (dspError) {
      return {
        ok: false,
        error: "Artist was created, but DSP profile links could not be saved. Open the artist and retry the DSP links.",
      };
    }
  }

  try {
    await supabase.rpc("write_audit_log", {
      p_action: "roster_artist_create",
      p_entity_type: "artist_profile",
      p_entity_id: artist.id,
      p_metadata: {
        label_profile_id: label.id,
        stage_name: stage,
        managed: true,
      },
    });
  } catch {
    /* ignore */
  }

  revalidatePath("/app/artists");
  return { ok: true, data: { id: artist.id } };
}

export async function updateRosterArtist(
  artistProfileId: string,
  input: Partial<RosterArtistInput>
): Promise<ActionResult<{ id: string }>> {
  const ctx = await RequireVerifiedPortal();
  if (!ctx.roles.includes("label")) return { ok: false, error: "Label role required." };
  try {
    assertCanMutateCatalog(ctx);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restricted." };
  }

  const supabase = await createClient();
  const { data: label } = await supabase
    .from("label_profiles")
    .select("id")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!label) return { ok: false, error: "Label profile not found." };

  const { data: link } = await supabase
    .from("label_roster_artists")
    .select("id")
    .eq("label_profile_id", label.id)
    .eq("artist_profile_id", artistProfileId)
    .maybeSingle();
  if (!link) return { ok: false, error: "Artist not on your roster." };

  const patch: Record<string, unknown> = {};
  if (input.stage_name !== undefined) {
    const stage = input.stage_name.trim();
    if (!stage) return { ok: false, error: "Stage / display name is required." };
    patch.stage_name = stage;
    patch.artist_name = stage;
  }
  if (input.bio !== undefined) patch.bio = input.bio?.trim() || null;
  if (input.country !== undefined) patch.country = input.country?.trim() || null;
  if (input.avatar_url !== undefined)
    patch.avatar_url = input.avatar_url?.trim() || null;
  if (input.website !== undefined) patch.website = input.website?.trim() || null;
  if (input.genres !== undefined) {
    patch.genres = (input.genres ?? []).map((g) => g.trim()).filter(Boolean);
  }

  // Never allow mutating login linkage via update
  // (user_id / profile_id stay null for roster artists)

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "No fields to update." };
  }

  const { error } = await supabase
    .from("artist_profiles")
    .update(patch)
    .eq("id", artistProfileId)
    .is("user_id", null);

  if (error) return { ok: false, error: error.message };

  try {
    await supabase.rpc("write_audit_log", {
      p_action: "roster_artist_update",
      p_entity_type: "artist_profile",
      p_entity_id: artistProfileId,
      p_metadata: { fields: Object.keys(patch) },
    });
  } catch {
    /* ignore */
  }

  revalidatePath("/app/artists");
  revalidatePath(`/app/artists/${artistProfileId}`);
  return { ok: true, data: { id: artistProfileId } };
}

export async function removeRosterArtist(
  artistProfileId: string
): Promise<ActionResult<{ id: string }>> {
  const ctx = await RequireVerifiedPortal();
  if (!ctx.roles.includes("label")) return { ok: false, error: "Label role required." };
  try {
    assertCanMutateCatalog(ctx);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restricted." };
  }

  const supabase = await createClient();
  const { data: label } = await supabase
    .from("label_profiles")
    .select("id")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!label) return { ok: false, error: "Label profile not found." };

  const { error } = await supabase
    .from("label_roster_artists")
    .delete()
    .eq("label_profile_id", label.id)
    .eq("artist_profile_id", artistProfileId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/artists");
  return { ok: true, data: { id: artistProfileId } };
}
