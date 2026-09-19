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
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {posts.length === 0 ? (
          <EmptyState
            title="No posts yet"
            description="Published articles will appear here."
          />
        ) : (
          <ul className="space-y-8">
            {posts.map((p) => (
              <li
                key={p.id}
                className="overflow-hidden rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] shadow-[var(--nexo-shadow-sm)]"
              >
                <Link
                  href={`/blog/${p.slug}`}
                  className="group grid md:grid-cols-[minmax(15rem,20rem)_1fr]"
                >
                  {p.cover_image_url ? (
                    <div className="overflow-hidden bg-[var(--nexo-elevated)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.cover_image_url}
                        alt={p.title}
                        className="aspect-[16/9] h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02] md:aspect-auto"
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="hidden min-h-48 bg-[var(--nexo-elevated)] md:block" aria-hidden />
                  )}

                  <div className="flex min-w-0 flex-col justify-center p-5 sm:p-6">
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-caption text-[var(--nexo-text-muted)]">
                      {p.published_at ? (
                        <time dateTime={p.published_at}>
                          {new Date(p.published_at).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </time>
                      ) : null}
                      {p.tags?.length ? <span aria-hidden>•</span> : null}
                      {p.tags?.length ? <span>{p.tags.slice(0, 3).join(" · ")}</span> : null}
                    </div>

                    <h2 className="text-h3 text-[var(--nexo-text)] group-hover:underline group-hover:underline-offset-4">
                      {p.title}
                    </h2>
                    {p.excerpt ? (
                      <p className="mt-3 line-clamp-3 text-small leading-6 text-[var(--nexo-text-muted)]">
                        {p.excerpt}
                      </p>
                    ) : null}
                    <span className="mt-5 text-small font-medium text-[var(--nexo-text)]">
                      Read article →
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
