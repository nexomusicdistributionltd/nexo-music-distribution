import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/marketing/PageHero";
import { SafeHtml } from "@/components/cms/SafeHtml";
import { getPublicArtistBySlug, listPublicReleases } from "@/lib/website/queries";
import { SITE_URL } from "@/lib/site";
import Link from "next/link";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublicArtistBySlug(slug);
  if (!a) return { title: "Artist" };
  const name = a.artist_name || a.stage_name;
  return {
    title: name,
    description: a.public_tagline || `Artist profile — ${name}`,
    alternates: { canonical: `${SITE_URL}/artists/${a.public_slug}` },
  };
}

export default async function PublicArtistPage({ params }: Props) {
  const { slug } = await params;
  const a = await getPublicArtistBySlug(slug);
  if (!a) notFound();
  const name = a.artist_name || a.stage_name;
  const releases = await listPublicReleases(24);
  const theirs = releases.filter(
    (r) => r.primary_artist_name.toLowerCase() === String(name).toLowerCase()
  );

  return (
    <>
      <PageHero
        eyebrow="Artist"
        title={name}
        description={a.public_tagline || undefined}
        crumbs={[
          { label: "Home", href: "/" },
          { label: "For Artists", href: "/artists" },
          { label: name },
        ]}
        showAside={false}
      />
      <section className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <SafeHtml
          html={a.public_bio_html}
          className="prose prose-neutral dark:prose-invert max-w-none text-small"
        />
        {theirs.length > 0 ? (
          <div>
            <h2 className="text-h4">Releases</h2>
            <ul className="mt-3 space-y-2">
              {theirs.map((r) => (
                <li key={r.id}>
                  <Link
                    href={r.website_slug ? `/music/${r.website_slug}` : `/music/${r.id}`}
                    className="text-small hover:underline"
                  >
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </>
  );
}
