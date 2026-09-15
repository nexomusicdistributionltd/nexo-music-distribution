import { ExternalLink } from "lucide-react";
import { isSafeHttpUrl } from "@/lib/website/sanitize";
import { youtubeEmbedSrc } from "@/lib/website/embeds";

export type VideoCardProps = {
  title: string;
  url: string;
  thumbnailUrl?: string | null;
};

/**
 * Videos display in Nexo chrome. External hosts are labeled — never downloaded.
 * YouTube may render an embed inside Nexo frame; other hosts are outbound only.
 */
export function VideoCard({ title, url, thumbnailUrl }: VideoCardProps) {
  if (!isSafeHttpUrl(url)) return null;
  const yt = youtubeEmbedSrc(url);

  return (
    <article className="overflow-hidden rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)]">
      {yt ? (
        <div className="aspect-video w-full bg-black">
          <iframe
            title={title}
            src={yt}
            className="h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : thumbnailUrl && isSafeHttpUrl(thumbnailUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbnailUrl} alt="" className="aspect-video w-full object-cover" />
      ) : (
        <div className="flex aspect-video items-center justify-center bg-[var(--nexo-elevated)] text-caption text-[var(--nexo-text-muted)]">
          External video
        </div>
      )}
      <div className="space-y-2 p-4">
        <h3 className="text-small font-medium text-[var(--nexo-text)]">{title}</h3>
        <p className="text-caption text-[var(--nexo-text-muted)]">External source</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-caption text-[var(--nexo-text-secondary)] underline-offset-4 hover:underline"
        >
          Open original <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </div>
    </article>
  );
}
