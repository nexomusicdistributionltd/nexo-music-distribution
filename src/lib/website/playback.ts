/**
 * Nexo-owned public playback eligibility and signed-URL helpers.
 * Only stream audio Nexo is authorized to host from release-audio when:
 *   website_published AND website_playback_enabled
 * and (for tracks) website_preview_enabled when that flag is present.
 */

import "server-only";

import { createSignedAssetUrl } from "@/lib/admin/queries";
import { createClient } from "@/lib/supabase/server";
import { canOfferWebsitePlayback, isTrackPlaybackEligible } from "./eligibility";

export type PlaybackTrack = {
  id: string;
  track_number: number;
  title: string;
  version: string | null;
  duration_ms: number | null;
  explicit: boolean | null;
  website_preview_enabled: boolean | null;
  signedUrl: string | null;
};

export type PlaybackReleasePayload = {
  eligible: boolean;
  releaseId: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  tracks: PlaybackTrack[];
};

export async function getReleasePlaybackPayload(
  releaseId: string
): Promise<PlaybackReleasePayload | null> {
  const supabase = await createClient();
  const { data: release, error } = await supabase
    .from("releases")
    .select(
      "id, title, primary_artist_name, website_published, website_playback_enabled, website_cover_override_url, release_tracks(id, track_number, title, version, duration_ms, explicit, website_preview_enabled), release_assets(id, kind, storage_bucket, storage_path, track_id)"
    )
    .eq("id", releaseId)
    .eq("website_published", true)
    .maybeSingle();

  if (error || !release) return null;

  const eligible = canOfferWebsitePlayback(release);
  const assets = (release.release_assets ?? []) as Array<{
    id: string;
    kind: string;
    storage_bucket: string;
    storage_path: string;
    track_id: string | null;
  }>;

  let artworkUrl: string | null = release.website_cover_override_url ?? null;
  if (!artworkUrl) {
    const art = assets.find((a) => a.kind === "artwork");
    if (art) {
      artworkUrl = await createSignedAssetUrl(art.storage_bucket, art.storage_path, 300);
    }
  }

  const tracksRaw = (
    (release.release_tracks ?? []) as Array<{
      id: string;
      track_number: number;
      title: string;
      version: string | null;
      duration_ms: number | null;
      explicit: boolean | null;
      website_preview_enabled: boolean | null;
    }>
  )
    .slice()
    .sort((a, b) => a.track_number - b.track_number);

  const tracks: PlaybackTrack[] = [];
  for (const t of tracksRaw) {
    const trackEligible = isTrackPlaybackEligible({
      website_published: release.website_published,
      website_playback_enabled: release.website_playback_enabled,
      website_preview_enabled: t.website_preview_enabled,
    });
    let signedUrl: string | null = null;
    if (eligible && trackEligible) {
      const audio =
        assets.find((a) => a.kind === "audio" && a.track_id === t.id) ||
        (tracksRaw.length === 1
          ? assets.find((a) => a.kind === "audio" && !a.track_id)
          : undefined) ||
        (t.track_number === 1
          ? assets.find((a) => a.kind === "audio" && !a.track_id)
          : undefined);
      if (audio && audio.storage_bucket === "release-audio") {
        signedUrl = await createSignedAssetUrl(audio.storage_bucket, audio.storage_path, 180);
      }
    }
    tracks.push({
      id: t.id,
      track_number: t.track_number,
      title: t.title,
      version: t.version,
      duration_ms: t.duration_ms,
      explicit: t.explicit,
      website_preview_enabled: t.website_preview_enabled,
      signedUrl,
    });
  }

  return {
    eligible,
    releaseId: release.id,
    title: release.title,
    artistName: release.primary_artist_name,
    artworkUrl,
    tracks,
  };
}
