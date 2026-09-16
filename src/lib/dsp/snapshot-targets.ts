import type { SupabaseClient } from "@supabase/supabase-js";
import { enabledDspTargets, type ArtistDspLink } from "@/lib/dsp/profile-links";

/** Snapshot enabled DSP profile links onto a release for delivery targeting metadata. */
export async function snapshotReleaseDspTargets(
  supabase: SupabaseClient,
  releaseId: string,
  artistProfileId: string | null | undefined
): Promise<void> {
  if (!artistProfileId) return;
  const { data } = await supabase
    .from("artist_dsp_links")
    .select("id, dsp_key, url, enabled, preview_name, preview_image_url, preview_canonical_url")
    .eq("artist_profile_id", artistProfileId);
  const enabled = enabledDspTargets((data ?? []) as ArtistDspLink[]);
  await supabase.from("release_dsp_profile_targets").delete().eq("release_id", releaseId);
  if (enabled.length === 0) return;
  const rows = enabled
    .filter((l) => l.url)
    .map((l) => ({
      release_id: releaseId,
      dsp_key: l.dsp_key,
      url: l.url as string,
      enabled: true,
      artist_dsp_link_id: (data ?? []).find((r) => r.dsp_key === l.dsp_key)?.id ?? null,
    }));
  if (rows.length) {
    await supabase.from("release_dsp_profile_targets").insert(rows);
  }
}
