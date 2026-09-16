"use server";

import { revalidatePath } from "next/cache";
import { RequireRole, assertCanMutateCatalog } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  DSP_PROFILE_SPECS,
  validateDspProfileUrl,
  type DspProfileKey,
} from "@/lib/dsp/profile-links";
import { fetchDspProfilePreview } from "@/lib/dsp/fetch-preview";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function assertCanEditArtist(artistProfileId: string) {
  const ctx = await RequireRole(["artist", "label"]);
  try {
    assertCanMutateCatalog(ctx);
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Restricted." };
  }
  const supabase = await createClient();
  const { data: artist } = await supabase
    .from("artist_profiles")
    .select("id, user_id")
    .eq("id", artistProfileId)
    .maybeSingle();
  if (!artist) return { ok: false as const, error: "Artist not found." };
  if (ctx.roles.includes("artist") && artist.user_id === ctx.userId) {
    return { ok: true as const, ctx, supabase };
  }
  if (ctx.roles.includes("label")) {
    const { data: label } = await supabase
      .from("label_profiles")
      .select("id")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (!label) return { ok: false as const, error: "Label profile not found." };
    const { data: link } = await supabase
      .from("label_roster_artists")
      .select("id")
      .eq("label_profile_id", label.id)
      .eq("artist_profile_id", artistProfileId)
      .maybeSingle();
    if (!link) return { ok: false as const, error: "Artist not on your roster." };
    return { ok: true as const, ctx, supabase };
  }
  return { ok: false as const, error: "Not allowed." };
}

export async function previewDspProfileAction(input: {
  dspKey: string;
  url: string;
}): Promise<ActionResult<{ name: string | null; image: string | null; canonicalUrl: string | null }>> {
  await RequireRole(["artist", "label"]);
  const check = validateDspProfileUrl(input.dspKey, input.url);
  if (!check.ok) return { ok: false, error: check.error };
  if (!check.url) return { ok: true, data: { name: null, image: null, canonicalUrl: null } };
  const preview = await fetchDspProfilePreview(input.dspKey, check.url);
  return { ok: true, data: preview };
}

export async function saveArtistDspLinksAction(input: {
  artistProfileId: string;
  links: Array<{
    dspKey: DspProfileKey;
    url: string;
    enabled: boolean;
    previewName?: string | null;
    previewImage?: string | null;
    previewCanonical?: string | null;
  }>;
}): Promise<ActionResult> {
  const gate = await assertCanEditArtist(input.artistProfileId);
  if (!gate.ok) return gate;
  const { supabase, ctx } = gate;

  for (const spec of DSP_PROFILE_SPECS) {
    const row = input.links.find((l) => l.dspKey === spec.key);
    const check = validateDspProfileUrl(spec.key, row?.url ?? "");
    if (!check.ok) return { ok: false, error: check.error };
    const enabled = Boolean(row?.enabled && check.url);
    const image = (row?.previewImage ?? "").trim();
    const imageOk = image.startsWith("https://") ? image : null;
    const { error } = await supabase.from("artist_dsp_links").upsert(
      {
        artist_profile_id: input.artistProfileId,
        dsp_key: spec.key,
        url: check.url,
        enabled,
        preview_name: row?.previewName?.trim() || null,
        preview_image_url: imageOk,
        preview_canonical_url: row?.previewCanonical?.trim() || check.url,
        fetched_at: check.url ? new Date().toISOString() : null,
      },
      { onConflict: "artist_profile_id,dsp_key" }
    );
    if (error) return { ok: false, error: error.message };
  }

  try {
    await supabase.rpc("write_audit_log", {
      p_action: "dsp_profile_update",
      p_entity_type: "artist_profile",
      p_entity_id: input.artistProfileId,
      p_metadata: { actor: ctx.userId },
    });
  } catch {
    /* ignore */
  }

  revalidatePath("/dashboard/profile");
  revalidatePath(`/app/artists/${input.artistProfileId}`);
  revalidatePath("/dashboard/releases/new");
  return { ok: true, data: true };
}

export async function saveArtistBioAction(input: {
  artistProfileId: string;
  bio: string;
}): Promise<ActionResult> {
  const gate = await assertCanEditArtist(input.artistProfileId);
  if (!gate.ok) return gate;
  const { error } = await gate.supabase
    .from("artist_profiles")
    .update({ bio: input.bio.trim() || null })
    .eq("id", input.artistProfileId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/profile");
  revalidatePath(`/app/artists/${input.artistProfileId}`);
  return { ok: true, data: true };
}
