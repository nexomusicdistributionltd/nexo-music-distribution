"use server";

import { revalidatePath } from "next/cache";
import { RequireRole, assertCanMutateCatalog } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { RosterArtistInput } from "@/lib/roster/types";

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
  input: RosterArtistInput
): Promise<ActionResult<{ id: string }>> {
  const ctx = await RequireRole("label");
  try {
    assertCanMutateCatalog(ctx);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restricted." };
  }

  const stage = input.stage_name?.trim();
  if (!stage) return { ok: false, error: "Stage / display name is required." };

  const supabase = await createClient();
  const { data: label } = await supabase
    .from("label_profiles")
    .select("id")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!label) return { ok: false, error: "Label profile not found." };

  // Snapshot Label account_type / roles — must remain unchanged after create
  const { data: profileBefore } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", ctx.userId)
    .maybeSingle();
  const { data: rolesBefore } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);

  const genres = (input.genres ?? []).map((g) => g.trim()).filter(Boolean);

  const { data: artist, error } = await supabase
    .from("artist_profiles")
    .insert({
      user_id: null,
      profile_id: null,
      stage_name: stage,
      artist_name: stage,
      bio: input.bio?.trim() || null,
      country: input.country?.trim() || null,
      genres,
      avatar_url: input.avatar_url?.trim() || null,
      website: input.website?.trim() || null,
      created_by_label_profile_id: label.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  const { error: linkErr } = await supabase.from("label_roster_artists").insert({
    label_profile_id: label.id,
    artist_profile_id: artist.id,
    created_by: ctx.userId,
  });
  if (linkErr) {
    // Best-effort cleanup of orphan profile row
    await supabase.from("artist_profiles").delete().eq("id", artist.id);
    return { ok: false, error: linkErr.message };
  }

  // Hard assert: Label user must not have gained artist role or account_type flip
  const { data: profileAfter } = await supabase
    .from("profiles")
    .select("account_type")
    .eq("id", ctx.userId)
    .maybeSingle();
  const { data: rolesAfter } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId);

  if (profileAfter?.account_type !== profileBefore?.account_type) {
    return {
      ok: false,
      error: "Invariant violated: account_type changed during roster create.",
    };
  }
  const beforeRoles = new Set((rolesBefore ?? []).map((r) => r.role));
  const afterRoles = new Set((rolesAfter ?? []).map((r) => r.role));
  if (afterRoles.has("artist") && !beforeRoles.has("artist")) {
    return {
      ok: false,
      error: "Invariant violated: artist role was added to Label user.",
    };
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
  const ctx = await RequireRole("label");
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
  const ctx = await RequireRole("label");
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
