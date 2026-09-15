import { NexoReleasePlayer, DspOutboundButtons } from "@/components/player";
import { buildDspOutboundLinks } from "@/lib/website/dsp-links";
import { canOfferWebsitePlayback } from "@/lib/website/eligibility";

type TrackInput = {
  id: string;
  title: string;
  version?: string | null;
  duration_ms?: number | null;
  durationMs?: number | null;
  signedUrl?: string | null;
};

type ReleasePlayerProps = {
  title?: string;
  artistName?: string;
  artworkUrl?: string | null;
  website_published?: boolean | null;
  website_playback_enabled?: boolean | null;
  website_embed_spotify_url?: string | null;
  website_embed_apple_url?: string | null;
  website_embed_youtube_url?: string | null;
  /** @deprecated Prefer tracks[].signedUrl — kept for single-audio callers */
  signedAudioUrl?: string | null;
  tracks?: TrackInput[];
};

/**
 * Public release playback: Nexo-owned HTML5 player first.
 * DSP URLs render as labeled outbound buttons only (no iframes).
 */
export function ReleasePlayer(props: ReleasePlayerProps) {
  const eligible = canOfferWebsitePlayback(props);
  const dsp = buildDspOutboundLinks(props);

  const tracks =
    props.tracks && props.tracks.length > 0
      ? props.tracks.map((t) => ({
          id: t.id,
          title: t.title,
          version: t.version,
          durationMs: t.durationMs ?? t.duration_ms ?? null,
          signedUrl: t.signedUrl ?? null,
        }))
      : props.signedAudioUrl
        ? [
            {
              id: "preview",
              title: props.title || "Preview",
              version: null,
              durationMs: null,
              signedUrl: props.signedAudioUrl,
            },
          ]
        : [];

  return (
    <div className="space-y-4">
      <NexoReleasePlayer
        title={props.title || "Release"}
        artistName={props.artistName || ""}
        artworkUrl={props.artworkUrl}
        tracks={tracks}
        eligible={eligible}
      />
      {dsp.length > 0 ? (
        <div>
          <p className="mb-2 text-caption uppercase tracking-[0.12em] text-[var(--nexo-text-muted)]">
            Also available on
          </p>
          <DspOutboundButtons links={dsp} />
        </div>
      ) : null}
    </div>
  );
}
