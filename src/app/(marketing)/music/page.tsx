import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/marketing/PageHero";
import { HeroImage } from "@/components/website/HeroImage";
import { listPublicReleases } from "@/lib/website/queries";
import { publicStatusLabel } from "@/lib/website/eligibility";
import { EmptyState } from "@/components/ui/EmptyState";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Music",
  description: "Featured releases from the NEXO Music Distribution catalog.",
  alternates: { canonical: `${SITE_URL}/music` },
};

export default async function MusicPage() {
  const releases = await listPublicReleases();

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
            {releases.map((r) => {
              const href = r.website_slug
                ? `/music/${r.website_slug}`
                : `/music/${r.id}`;
              const status = publicStatusLabel(r.status);
              return (
                <li key={r.id}>
                  <Link
                    href={href}
                    className="block rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 transition hover:border-[var(--nexo-border-strong)]"
                  >
                    <p className="text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">
                      {r.genre || "Release"}
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
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
