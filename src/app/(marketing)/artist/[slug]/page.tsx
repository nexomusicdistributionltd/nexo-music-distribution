import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SafeHtml } from "@/components/cms/SafeHtml";
import { ShareLinkButton } from "@/components/website/ShareLinkButton";
import { VideoCard } from "@/components/website/VideoCard";
import { Reveal } from "@/components/motion/Reveal";
import { PublicCatalogRealtime } from "@/components/website/PublicCatalogRealtime";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  getPublicArtistBySlug,
  listPublicReleasesForArtist,
  listPublishedVideos,
} from "@/lib/website/queries";
import { artistCanonicalPath, releaseCanonicalPath } from "@/lib/website/slugs";
import { artistMetadata, musicGroupJsonLd } from "@/lib/website/seo";
import { isSafeHttpUrl } from "@/lib/website/sanitize";
import { SITE_URL } from "@/lib/site";
import { ExternalLink } from "lucide-react";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublicArtistBySlug(slug);
  if (!a) return { title: "Artist" };
  const name = a.artist_name || a.stage_name || "Artist";
  return artistMetadata({
    name,
    description: a.public_tagline,
    slugPath: artistCanonicalPath(a.public_slug),
    image: a.avatar_url || a.cover_url,
  });
}

export default async function ArtistDetailPage({ params }: Props) {
  const { slug } = await params;
  const a = await getPublicArtistBySlug(slug);
  if (!a) notFound();

  const name = a.artist_name || a.stage_name || "Artist";
  const path = artistCanonicalPath(a.public_slug);
  const releases = await listPublicReleasesForArtist(name, 48);
  const videos = await listPublishedVideos({ artistId: a.id, limit: 12 });
  const socials = (a.social_links ?? {}) as Record<string, string>;
  const socialEntries = Object.entries(socials).filter(
    ([, v]) => typeof v === "string" && isSafeHttpUrl(v)
  );
  const byType = {
    album: releases.filter((r) => r.release_type === "album"),
    ep: releases.filter((r) => r.release_type === "ep"),
    single: releases.filter((r) => r.release_type === "single" || !r.release_type),
  };
  const jsonLd = musicGroupJsonLd({
    name,
    url: `${SITE_URL}${path}`,
    description: a.public_tagline,
    image: a.avatar_url || a.cover_url,
    sameAs: socialEntries.map(([, url]) => url),
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicCatalogRealtime />
      <section className="relative overflow-hidden border-b border-[var(--nexo-border)]">
        {a.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={a.cover_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-30"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--nexo-bg)]" aria-hidden />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 py-16 sm:px-6 lg:flex-row lg:items-end lg:px-8 lg:py-24">
          <Reveal>
            <div className="h-36 w-36 overflow-hidden rounded-full border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] shadow-[var(--nexo-shadow-lg)] sm:h-44 sm:w-44">
              {a.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-caption text-[var(--nexo-text-muted)]">
                  No photo
                </div>
              )}
            </div>
          </Reveal>
          <Reveal delayMs={80} className="min-w-0 flex-1">
            <p className="text-caption uppercase tracking-[0.14em] text-[var(--nexo-text-muted)]">
              Artist
              {a.country ? ` · ${a.country}` : ""}
            </p>
            <h1 className="mt-2 text-display text-[var(--nexo-text)]">{name}</h1>
            {a.public_tagline ? (
              <p className="mt-3 max-w-2xl text-body text-[var(--nexo-text-muted)]">
                {a.public_tagline}
              </p>
            ) : null}
            {(a.genres ?? []).length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {((a.genres ?? []) as string[]).map((g: string) => (
                  <li
                    key={g}
                    className="rounded-full border border-[var(--nexo-border)] px-3 py-1 text-caption text-[var(--nexo-text-secondary)]"
                  >
                    {g}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <ShareLinkButton url={`${SITE_URL}${path}`} />
              {a.entzopedia_url && isSafeHttpUrl(a.entzopedia_url) ? (
                <a
                  href={a.entzopedia_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--nexo-border)] px-3 py-2 text-small font-medium text-[var(--nexo-text)] hover:bg-[var(--nexo-ghost-hover)]"
                >
                  Full profile on Entzopedia <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              ) : null}
              {socialEntries.map(([key, url]) => (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-small text-[var(--nexo-text-secondary)] underline-offset-4 hover:underline"
                >
                  {key} <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-3xl space-y-6 px-4 py-12 sm:px-6 lg:px-8">
        <Reveal>
          {a.public_bio_html ? (
            <SafeHtml
              html={a.public_bio_html}
              className="prose prose-neutral dark:prose-invert max-w-none text-small"
            />
          ) : (
            <EmptyState
              title="Bio coming soon"
              description="This artist profile has no public biography yet."
            />
          )}
        </Reveal>
      </section>

      <section className="border-t border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
        <div className="mx-auto max-w-7xl space-y-10 px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-h2">Discography</h2>
          {releases.length === 0 ? (
            <EmptyState
              title="No public releases yet"
              description="Published releases for this artist will appear here."
            />
          ) : (
            (["album", "ep", "single"] as const).map((type) => {
              const list = byType[type];
              if (!list.length) return null;
              return (
                <Reveal key={type}>
                  <div>
                    <h3 className="text-h4 capitalize">{type === "ep" ? "EPs" : `${type}s`}</h3>
                    <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {list.map((r) => (
                        <li key={r.id}>
                          <Link
                            href={releaseCanonicalPath(r.website_slug, r.id)}
                            className="block rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4 transition hover:border-[var(--nexo-border-strong)]"
                          >
                            <p className="text-h4">{r.title}</p>
                            {r.website_blurb ? (
                              <p className="mt-2 line-clamp-2 text-caption text-[var(--nexo-text-muted)]">
                                {r.website_blurb}
                              </p>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              );
            })
          )}
        </div>
      </section>

      {videos.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-h3">Videos</h2>
          <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
            External sources · labeled clearly · not hosted by Nexo
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
    </>
  );
}
