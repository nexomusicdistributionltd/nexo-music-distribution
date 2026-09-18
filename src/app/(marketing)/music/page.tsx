import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/marketing/PageHero";
import { HeroImage } from "@/components/website/HeroImage";
import { Reveal } from "@/components/motion/Reveal";
import { listPublicArtists, listPublicReleases } from "@/lib/website/queries";
import { publicStatusLabel } from "@/lib/website/eligibility";
import { releaseCanonicalPath, artistCanonicalPath } from "@/lib/website/slugs";
import { EmptyState } from "@/components/ui/EmptyState";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Music",
  description: "Featured releases from the NEXO Music Distribution catalog.",
  alternates: { canonical: `${SITE_URL}/music` },
};

export default async function MusicPage() {
  const [releases, artists] = await Promise.all([
    listPublicReleases(),
    listPublicArtists(24),
  ]);

  return (
    <>
      <PageHero
        eyebrow="Catalog"
        title="Music"
        description="Public releases featured by Nexo. Status labels stay truthful — we never invent LIVE."
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Music" },
        ]}
        aside={<HeroImage preset="vinyl" alt="" priority />}
      />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {releases.length === 0 ? (
          <EmptyState
            title="No public releases yet"
            description="Published catalog entries will appear here when staff feature them."
          />
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {releases.map((r, i) => {
              const href = releaseCanonicalPath(r.website_slug, r.id);
              const status = publicStatusLabel(r.status);
              return (
                <Reveal key={r.id} delayMs={(i % 6) * 40} as="li">
                  <Link
                    href={href}
                    className="group block overflow-hidden rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] transition hover:border-[var(--nexo-border-strong)]"
                  >
                    <div className="aspect-square bg-[var(--nexo-elevated)]">
                      {r.website_cover_override_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.website_cover_override_url}
                          alt=""
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                      ) : null}
                    </div>
                    <div className="p-5">
                      <p className="text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">
                        {r.genre || r.release_type || "Release"}
                        {r.website_featured ? " · Featured" : ""}
                      </p>
                      <h2 className="mt-2 text-h4 text-[var(--nexo-text)]">{r.title}</h2>
                      <p className="mt-1 text-small text-[var(--nexo-text-secondary)]">
                        {r.primary_artist_name}
                      </p>
                      {r.website_blurb ? (
                        <p className="mt-3 line-clamp-3 text-caption text-[var(--nexo-text-muted)]">
                          {r.website_blurb}
                        </p>
                      ) : null}
                      {status ? (
                        <p className="mt-3 text-caption text-[var(--nexo-text-muted)]">{status}</p>
                      ) : null}
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </ul>
        )}

        {artists.length > 0 ? (
          <div className="mt-16">
            <h2 className="text-h3">Artists</h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {artists.map((a) => {
                const name = a.artist_name || a.stage_name || "Artist";
                if (!a.public_slug) return null;
                return (
                  <li key={a.id}>
                    <Link
                      href={artistCanonicalPath(a.public_slug)}
                      className="flex items-center gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-3 transition hover:border-[var(--nexo-border-strong)]"
                    >
                      <div className="h-12 w-12 overflow-hidden rounded-full bg-[var(--nexo-elevated)]">
                        {a.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-small font-medium">{name}</p>
                        {a.public_tagline ? (
                          <p className="truncate text-caption text-[var(--nexo-text-muted)]">
                            {a.public_tagline}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </section>
    </>
  );
}
