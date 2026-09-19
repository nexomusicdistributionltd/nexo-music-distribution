import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/marketing/PageHero";
import { SafeHtml } from "@/components/cms/SafeHtml";
import { getPublishedPostBySlug } from "@/lib/blog/queries";
import { SITE_URL } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return { title: "Blog" };
  const title = post.seo_title || post.title;
  const description = post.seo_description || post.excerpt || undefined;
  const canonical = `${SITE_URL}/blog/${post.slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: "article",
      url: canonical,
      ...(post.cover_image_url ? { images: [{ url: post.cover_image_url }] } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();

  return (
    <>
      <PageHero
        eyebrow="Blog"
        title={post.title}
        description={post.excerpt || undefined}
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Blog", href: "/blog" },
          { label: post.title },
        ]}
        showAside={false}
      />
      <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {post.cover_image_url ? (
          <figure className="mb-10 overflow-hidden rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] shadow-[var(--nexo-shadow-sm)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="aspect-[16/9] w-full object-cover"
              loading="eager"
              decoding="async"
            />
          </figure>
        ) : null}

        <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--nexo-border)] pb-5 text-caption text-[var(--nexo-text-muted)]">
          {post.published_at ? (
            <time dateTime={post.published_at}>
              {new Date(post.published_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          ) : null}
          {Array.isArray(post.tags) && post.tags.length > 0 ? (
            <span>{post.tags.join(" · ")}</span>
          ) : null}
        </div>

        <SafeHtml html={post.body_html} className="nexo-blog-article" />
      </article>
    </>
  );
}
