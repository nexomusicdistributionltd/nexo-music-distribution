import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { Section, Eyebrow } from "@/components/marketing/Section";
import type { PublicArtistCard, PublicReleaseCard } from "@/lib/website/queries";
import { artistCanonicalPath, releaseCanonicalPath } from "@/lib/website/slugs";

export function HomeFeaturedCatalog({
  releases,
  artists,
  showReleases = true,
  showArtists = true,
}: {
  releases: PublicReleaseCard[];
  artists: PublicArtistCard[];
  showReleases?: boolean;
  showArtists?: boolean;
}) {
  if (!showReleases && !showArtists) return null;
  if (releases.length === 0 && artists.length === 0) return null;

  return (
    <>
      {showReleases && releases.length > 0 ? (
        <Section id="featured-releases">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <Eyebrow>Discover</Eyebrow>
              <h2 className="mt-3 text-h2 text-[var(--nexo-text)]">Featured releases</h2>
              <p className="mt-3 text-body text-[var(--nexo-text-muted)]">
                Real catalog entries published by Nexo — no invented trending charts.
              </p>
            </div>
            <Link
              href="/music"
              className="text-small text-[var(--nexo-text-secondary)] underline-offset-4 hover:underline"
            >
              Browse music
            </Link>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {releases.map((r, i) => (
              <Reveal key={r.id} as="li" delayMs={(i % 4) * 50}>
                <Link
                  href={releaseCanonicalPath(r.website_slug, r.id)}
                  className="group block overflow-hidden rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] transition hover:border-[var(--nexo-border-strong)]"
                >
                  <div className="aspect-square bg-[var(--nexo-elevated)]">
                    {r.website_cover_override_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.website_cover_override_url}
                        alt=""
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                      />
                    ) : null}
                  </div>
                  <div className="p-4">
                    <p className="truncate text-h4">{r.title}</p>
                    <p className="mt-1 truncate text-caption text-[var(--nexo-text-muted)]">
                      {r.primary_artist_name}
                    </p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </ul>
        </Section>
      ) : null}

      {showArtists && artists.length > 0 ? (
        <Section id="featured-artists" surface>
          <div className="max-w-2xl">
            <Eyebrow>Artists</Eyebrow>
            <h2 className="mt-3 text-h2">Featured artists</h2>
            <p className="mt-3 text-body text-[var(--nexo-text-muted)]">
              Profiles published to the Nexo website — bios and discography when available.
            </p>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {artists.map((a, i) => {
              const name = a.artist_name || a.stage_name || "Artist";
              if (!a.public_slug) return null;
              return (
                <Reveal key={a.id} as="li" delayMs={(i % 4) * 50}>
                  <Link
                    href={artistCanonicalPath(a.public_slug)}
                    className="flex items-center gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4 transition hover:border-[var(--nexo-border-strong)]"
                  >
                    <div className="h-14 w-14 overflow-hidden rounded-full bg-[var(--nexo-elevated)]">
                      {a.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{name}</p>
                      {a.public_tagline ? (
                        <p className="truncate text-caption text-[var(--nexo-text-muted)]">
                          {a.public_tagline}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </ul>
        </Section>
      ) : null}
    </>
  );
}
