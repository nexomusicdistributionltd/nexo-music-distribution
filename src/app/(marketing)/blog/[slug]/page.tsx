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
  return {
    title: post.seo_title || post.title,
    description: post.seo_description || post.excerpt || undefined,
    alternates: { canonical: `${SITE_URL}/blog/${post.slug}` },
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
      <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <SafeHtml
          html={post.body_html}
          className="prose prose-neutral dark:prose-invert max-w-none"
        />
      </article>
    </>
  );
}
