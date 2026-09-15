import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/marketing/PageHero";
import { ReleasePlayer } from "@/components/website/ReleasePlayer";
import {
  getPublicReleaseById,
  getPublicReleaseBySlug,
} from "@/lib/website/queries";
import { publicStatusLabel } from "@/lib/website/eligibility";
import { SITE_URL } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

async function loadRelease(slug: string) {
  const bySlug = await getPublicReleaseBySlug(slug);
  if (bySlug) return bySlug;
  // UUID fallback
  if (/^[0-9a-f-]{36}$/i.test(slug)) {
    return getPublicReleaseById(slug);
  }
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = await loadRelease(slug);
  if (!r) return { title: "Release" };
  return {
    title: r.title,
    description: r.website_blurb || `${r.title} by ${r.primary_artist_name}`,
    alternates: { canonical: `${SITE_URL}/music/${r.website_slug || r.id}` },
  };
}

export default async function PublicReleasePage({ params }: Props) {
  const { slug } = await params;
  const r = await loadRelease(slug);
  if (!r) notFound();
  const status = publicStatusLabel(r.status);
  const tracks = (r.release_tracks ?? []) as Array<{
    id: string;
    track_number: number;
    title: string;
    duration_ms: number | null;
  }>;

  return (
    <>
      <PageHero
        eyebrow={r.primary_artist_name}
        title={r.title}
        description={r.website_blurb || undefined}
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Music", href: "/music" },
          { label: r.title },
        ]}
        showAside={false}
      />
      <section className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        {status ? (
          <p className="text-small text-[var(--nexo-text-muted)]">{status}</p>
        ) : null}
        <ReleasePlayer
          website_published={r.website_published}
          website_playback_enabled={r.website_playback_enabled}
          website_embed_spotify_url={r.website_embed_spotify_url}
          website_embed_apple_url={r.website_embed_apple_url}
          website_embed_youtube_url={r.website_embed_youtube_url}
        />
        {tracks.length > 0 ? (
          <div>
            <h2 className="text-h4">Tracks</h2>
            <ol className="mt-3 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
              {tracks
                .slice()
                .sort((a, b) => a.track_number - b.track_number)
                .map((t) => (
                  <li key={t.id} className="flex justify-between px-4 py-3 text-small">
                    <span>
                      {t.track_number}. {t.title}
                    </span>
                    {t.duration_ms ? (
                      <span className="text-caption text-[var(--nexo-text-muted)]">
                        {Math.floor(t.duration_ms / 60000)}:
                        {String(Math.floor((t.duration_ms % 60000) / 1000)).padStart(2, "0")}
                      </span>
                    ) : null}
                  </li>
                ))}
            </ol>
          </div>
        ) : null}
      </section>
    </>
  );
}
