import { ExternalLink, Play } from "lucide-react";
import { isSafeHttpUrl } from "@/lib/website/sanitize";
import { youtubeEmbedSrc } from "@/lib/website/embeds";

export type VideoCardProps = {
  title: string;
  url: string;
  thumbnailUrl?: string | null;
};

function directVideoSource(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /\.(mp4|webm|ogg|mov)(?:$|\?)/i.test(parsed.pathname + parsed.search);
  } catch {
    return false;
  }
}

/**
 * Nexo-branded video surface.
 * Direct media URLs use the browser's native video element inside Nexo chrome.
 * Recognized YouTube URLs use a privacy-enhanced embed but remain clearly identified
 * as an externally hosted source; other links stay outbound rather than faking playback.
 */
export function VideoCard({ title, url, thumbnailUrl }: VideoCardProps) {
  if (!isSafeHttpUrl(url)) return null;
  const yt = youtubeEmbedSrc(url);
  const direct = directVideoSource(url);

  return (
    <article className="overflow-hidden rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] shadow-[var(--nexo-shadow-sm)]">
      <div className="flex items-center justify-between border-b border-[var(--nexo-divider)] px-3 py-2">
        <span className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--nexo-text-muted)]">
          Nexo Music Video
        </span>
        <span className="inline-flex items-center gap-1 text-[0.62rem] text-[var(--nexo-text-muted)]">
          <Play className="h-3 w-3" aria-hidden /> Player
        </span>
      </div>
      {direct ? (
        <div className="aspect-video w-full bg-black">
          <video
            controls
            preload="metadata"
            poster={thumbnailUrl && isSafeHttpUrl(thumbnailUrl) ? thumbnailUrl : undefined}
            className="h-full w-full"
          >
            <source src={url} />
            Your browser does not support this video.
          </video>
        </div>
      ) : yt ? (
        <div className="aspect-video w-full bg-black">
          <iframe
            title={title}
            src={yt}
            className="h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : thumbnailUrl && isSafeHttpUrl(thumbnailUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbnailUrl} alt="" className="aspect-video w-full object-cover" />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-[var(--nexo-elevated)] text-caption text-[var(--nexo-text-muted)]">
          Video source available
        </div>
      )}
      <div className="space-y-2 p-4">
        <h3 className="text-small font-medium text-[var(--nexo-text)]">{title}</h3>
        <p className="text-caption text-[var(--nexo-text-muted)]">
          {direct ? "Played in the Nexo video player" : yt ? "Nexo player frame · externally hosted media" : "External media source"}
        </p>
        {!direct ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-caption text-[var(--nexo-text-secondary)] underline-offset-4 hover:underline"
          >
            Open source <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        ) : null}
      </div>
    </article>
  );
}
