import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReleasePlayer } from "@/components/website/ReleasePlayer";
import { ShareLinkButton } from "@/components/website/ShareLinkButton";
import { VideoCard } from "@/components/website/VideoCard";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  getPublicReleaseById,
  getPublicReleaseBySlug,
  listPublishedVideos,
  listRelatedPublicReleases,
} from "@/lib/website/queries";
import { getReleasePlaybackPayload } from "@/lib/website/playback";
import { publicStatusLabel } from "@/lib/website/eligibility";
import { releaseCanonicalPath } from "@/lib/website/slugs";
import { musicAlbumJsonLd, releaseMetadata } from "@/lib/website/seo";
import { SITE_URL } from "@/lib/site";
import { formatDuration } from "@/components/player/format";

type Props = { params: Promise<{ slug: string }> };

async function loadRelease(slug: string) {
  const bySlug = await getPublicReleaseBySlug(slug);
  if (bySlug) return bySlug;
  if (/^[0-9a-f-]{36}$/i.test(slug)) {
    return getPublicReleaseById(slug);
  }
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = await loadRelease(slug);
  if (!r) return { title: "Release" };
  const path = releaseCanonicalPath(r.website_slug, r.id);
  return releaseMetadata({
    title: r.title,
    artist: r.primary_artist_name,
    description: r.website_blurb,
    slugPath: path,
    image: r.website_cover_override_url,
  });
}

export default async function ReleaseDetailPage({ params }: Props) {
  const { slug } = await params;
  const r = await loadRelease(slug);
  if (!r) notFound();

  const path = releaseCanonicalPath(r.website_slug, r.id);
  const playback = await getReleasePlaybackPayload(r.id);
  const status = publicStatusLabel(r.status);
  const tracks = (r.release_tracks ?? []) as Array<{
    id: string;
    track_number: number;
    title: string;
    version: string | null;
    duration_ms: number | null;
    explicit: boolean | null;
  }>;
  const contributors = (r.release_contributors ?? []) as Array<{
    id: string;
    name: string;
    role: string;
    track_id: string | null;
  }>;
  const videos = await listPublishedVideos({ releaseId: r.id, limit: 8 });
  const related = await listRelatedPublicReleases(r.id, r.primary_artist_name, 6);
  const jsonLd = musicAlbumJsonLd({
    name: r.title,
    byArtist: r.primary_artist_name,
    url: `${SITE_URL}${path}`,
    image: r.website_cover_override_url,
    datePublished: r.release_date,
    tracks: tracks
      .slice()
      .sort((a, b) => a.track_number - b.track_number)
      .map((t) => ({ name: t.title, position: t.track_number })),
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="relative overflow-hidden border-b border-[var(--nexo-border)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 20% 0%, color-mix(in srgb, var(--nexo-text) 12%, transparent), transparent 55%)",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8 lg:py-20">
          <Reveal>
            <div className="mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-[1.25rem] border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] shadow-[var(--nexo-shadow-lg)]">
              {playback?.artworkUrl || r.website_cover_override_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={playback?.artworkUrl || r.website_cover_override_url}
                  alt=""
                  className="h-full w-full object-cover transition duration-700 hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-caption text-[var(--nexo-text-muted)]">
                  Artwork unavailable
                </div>
              )}
            </div>
          </Reveal>
          <Reveal delayMs={80}>
            <div>
              <p className="text-caption uppercase tracking-[0.14em] text-[var(--nexo-text-muted)]">
                {r.release_type || "Release"}
                {r.genre ? ` · ${r.genre}` : ""}
                {status ? ` · ${status}` : ""}
              </p>
              <h1 className="mt-3 text-display text-[var(--nexo-text)]">{r.title}</h1>
              <p className="mt-2 text-h4 text-[var(--nexo-text-secondary)]">
                {r.primary_artist_name}
              </p>
              {r.website_blurb ? (
                <p className="mt-4 max-w-2xl text-body text-[var(--nexo-text-muted)]">
                  {r.website_blurb}
                </p>
              ) : null}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <ShareLinkButton url={`${SITE_URL}${path}`} />
                <Link
                  href="/music"
                  className="text-small text-[var(--nexo-text-secondary)] underline-offset-4 hover:underline"
                >
                  Back to Music
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <Reveal>
          <ReleasePlayer
            title={r.title}
            artistName={r.primary_artist_name}
            artworkUrl={playback?.artworkUrl || r.website_cover_override_url}
            website_published={r.website_published}
            website_playback_enabled={r.website_playback_enabled}
            website_embed_spotify_url={r.website_embed_spotify_url}
            website_embed_apple_url={r.website_embed_apple_url}
            website_embed_youtube_url={r.website_embed_youtube_url}
            tracks={(playback?.tracks ?? []).map((t) => ({
              id: t.id,
              title: t.title,
              version: t.version,
              durationMs: t.duration_ms,
              signedUrl: t.signedUrl,
            }))}
          />
        </Reveal>

        <div className="space-y-8">
          <Reveal>
            <div>
              <h2 className="text-h4">Tracks</h2>
              {tracks.length === 0 ? (
                <EmptyState
                  title="No tracks listed"
                  description="Track metadata will appear when available."
                />
              ) : (
                <ol className="mt-3 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
                  {tracks
                    .slice()
                    .sort((a, b) => a.track_number - b.track_number)
                    .map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-small">
                        <span>
                          <span className="mr-2 tabular-nums text-[var(--nexo-text-muted)]">
                            {t.track_number}.
                          </span>
                          {t.title}
                          {t.version ? (
                            <span className="text-[var(--nexo-text-muted)]"> ({t.version})</span>
                          ) : null}
                          {t.explicit ? (
                            <span className="ml-2 text-caption text-[var(--nexo-text-muted)]">E</span>
                          ) : null}
                        </span>
                        <span className="text-caption tabular-nums text-[var(--nexo-text-muted)]">
                          {formatDuration(t.duration_ms)}
                        </span>
                      </li>
                    ))}
                </ol>
              )}
            </div>
          </Reveal>

          {contributors.length > 0 ? (
            <Reveal>
              <div>
                <h2 className="text-h4">Credits</h2>
                <ul className="mt-3 space-y-1 text-small text-[var(--nexo-text-secondary)]">
                  {contributors.map((c) => (
                    <li key={c.id}>
                      {c.name}
                      <span className="text-[var(--nexo-text-muted)]">
                        {" "}
                        · {String(c.role).replace(/_/g, " ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ) : null}
        </div>
      </section>

      {videos.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <h2 className="text-h3">Videos</h2>
          <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
            External sources shown in Nexo chrome — not hosted by Nexo.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <VideoCard
                key={v.id}
                title={v.title}
                url={v.url}
                thumbnailUrl={v.thumbnail_url}
              />
            ))}
          </div>
        </section>
      ) : null}

      {related.length > 0 ? (
        <section className="border-t border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <h2 className="text-h3">More from {r.primary_artist_name}</h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((rel) => (
                <li key={rel.id}>
                  <Link
                    href={releaseCanonicalPath(rel.website_slug, rel.id)}
                    className="block rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4 transition hover:border-[var(--nexo-border-strong)]"
                  >
                    <p className="text-h4">{rel.title}</p>
                    <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                      {rel.genre || rel.release_type || "Release"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}
