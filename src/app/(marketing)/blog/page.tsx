import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/marketing/PageHero";
import { HeroImage } from "@/components/website/HeroImage";
import { listPublishedPosts } from "@/lib/blog/queries";
import { EmptyState } from "@/components/ui/EmptyState";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog",
  description: "News and updates from NEXO Music Distribution.",
  alternates: { canonical: `${SITE_URL}/blog` },
};

export default async function BlogIndexPage() {
  const posts = await listPublishedPosts();

  return (
    <>
      <PageHero
        eyebrow="Insights"
        title="Blog"
        description="Updates from Nexo — distribution, publishing, and catalog care."
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Blog" },
        ]}
        aside={<HeroImage preset="score" alt="" />}
      />
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {posts.length === 0 ? (
          <EmptyState
            title="No posts yet"
            description="Published articles will appear here."
          />
        ) : (
          <ul className="space-y-6">
            {posts.map((p) => (
              <li key={p.id} className="border-b border-[var(--nexo-border)] pb-6">
                <Link href={`/blog/${p.slug}`} className="group">
                  <h2 className="text-h4 group-hover:underline">{p.title}</h2>
                  {p.excerpt ? (
                    <p className="mt-2 text-small text-[var(--nexo-text-muted)]">{p.excerpt}</p>
                  ) : null}
                  {p.published_at ? (
                    <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
                      {new Date(p.published_at).toLocaleDateString()}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
