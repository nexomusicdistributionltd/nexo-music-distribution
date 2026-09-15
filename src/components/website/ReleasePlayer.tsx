import { resolveEmbed } from "@/lib/website/embeds";
import { canOfferWebsitePlayback, hasOfficialEmbed } from "@/lib/website/eligibility";

type ReleasePlayerProps = {
  website_published?: boolean | null;
  website_playback_enabled?: boolean | null;
  website_embed_spotify_url?: string | null;
  website_embed_apple_url?: string | null;
  website_embed_youtube_url?: string | null;
  /** Optional signed URL — only pass when canOfferWebsitePlayback is true server-side. */
  signedAudioUrl?: string | null;
};

export function ReleasePlayer(props: ReleasePlayerProps) {
  const spotify = resolveEmbed("spotify", props.website_embed_spotify_url);
  const apple = resolveEmbed("apple", props.website_embed_apple_url);
  const youtube = resolveEmbed("youtube", props.website_embed_youtube_url);

  if (hasOfficialEmbed(props) && (spotify || apple || youtube)) {
    return (
      <div className="space-y-4">
        {spotify ? (
          <iframe
            title="Spotify embed"
            src={spotify}
            className="h-[152px] w-full rounded-[var(--nexo-radius)] border-0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
          />
        ) : null}
        {apple ? (
          <iframe
            title="Apple Music embed"
            src={apple}
            className="h-[175px] w-full rounded-[var(--nexo-radius)] border-0"
            allow="autoplay *; encrypted-media *; fullscreen *"
            loading="lazy"
          />
        ) : null}
        {youtube ? (
          <iframe
            title="YouTube embed"
            src={youtube}
            className="aspect-video w-full rounded-[var(--nexo-radius)] border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            loading="lazy"
          />
        ) : null}
      </div>
    );
  }

  if (canOfferWebsitePlayback(props) && props.signedAudioUrl) {
    return (
      <audio controls preload="none" className="w-full" src={props.signedAudioUrl}>
        Your browser does not support audio playback.
      </audio>
    );
  }

  return (
    <p className="text-small text-[var(--nexo-text-muted)]">
      No official embed or enabled preview for this release.
    </p>
  );
}
