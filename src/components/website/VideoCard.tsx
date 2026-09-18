import { ExternalLink, Play } from "lucide-react";
import { isSafeHttpUrl } from "@/lib/website/sanitize";
import { directVideoSrc, vimeoEmbedSrc, youtubeEmbedSrc } from "@/lib/website/embeds";

export type VideoCardProps = {
  title: string;
  url: string;
  thumbnailUrl?: string | null;
};

export function VideoCard({ title, url, thumbnailUrl }: VideoCardProps) {
  if (!isSafeHttpUrl(url)) return null;

  const youtube = youtubeEmbedSrc(url);
  const vimeo = vimeoEmbedSrc(url);
  const direct = directVideoSrc(url);
  const frame = youtube || vimeo;
  const hasThumbnail = Boolean(thumbnailUrl && isSafeHttpUrl(thumbnailUrl));

  return (
    <article className="group overflow-hidden border border-[var(--nexo-border)] bg-[var(--nexo-card)]">
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        <div className="pointer-events-none absolute left-3 top-3 z-20 inline-flex items-center gap-2 border border-white/20 bg-black/70 px-2.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur">
          <span className="inline-flex h-5 w-5 items-center justify-center bg-white text-black">N</span>
          Nexo Video
        </div>

        {frame ? (
          <iframe
            title={title}
            src={frame}
            className="h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : direct ? (
          <video
            className="h-full w-full object-contain"
            controls
            preload="metadata"
            poster={hasThumbnail ? thumbnailUrl ?? undefined : undefined}
            playsInline
          >
            <source src={direct} />
          </video>
        ) : hasThumbnail ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative block h-full w-full"
            aria-label={`Open ${title} video`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumbnailUrl ?? ""} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/20">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-black shadow-xl">
                <Play className="h-5 w-5 translate-x-px" fill="currentColor" aria-hidden />
              </span>
            </span>
          </a>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[var(--nexo-elevated)] px-6 text-center"
          >
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--nexo-text)] text-[var(--nexo-bg)]">
              <Play className="h-5 w-5 translate-x-px" fill="currentColor" aria-hidden />
            </span>
            <span className="text-caption text-[var(--nexo-text-muted)]">
              Open video in its source player
            </span>
          </a>
        )}
      </div>

      <div className="flex items-start justify-between gap-4 p-4">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--nexo-text-muted)]">
            Nexo Music Distribution
          </p>
          <h3 className="mt-1 text-small font-medium text-[var(--nexo-text)]">{title}</h3>
        </div>
        {!frame && !direct ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-caption text-[var(--nexo-text-secondary)] underline-offset-4 hover:underline"
          >
            Source <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        ) : null}
      </div>
    </article>
  );
}
