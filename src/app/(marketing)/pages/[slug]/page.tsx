import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/marketing/PageHero";
import { SafeHtml } from "@/components/cms/SafeHtml";
import { getPublishedPageBySlug } from "@/lib/cms/pages";
import { SITE_URL } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPageBySlug(slug);
  if (!page) return { title: "Page" };
  return {
    title: page.seo_title || page.title,
    description: page.seo_description || undefined,
    alternates: { canonical: `${SITE_URL}/pages/${page.slug}` },
  };
}

export default async function CmsPage({ params }: Props) {
  const { slug } = await params;
  // Dedicated legal routes take precedence
  if (["privacy", "terms", "cookies"].includes(slug)) notFound();
  const page = await getPublishedPageBySlug(slug);
  if (!page) notFound();

  return (
    <>
      <PageHero
        title={page.title}
        crumbs={[
          { label: "Home", href: "/" },
          { label: page.title },
        ]}
        showAside={false}
      />
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <SafeHtml
          html={page.body_html}
          className="prose prose-neutral dark:prose-invert max-w-none"
        />
      </section>
    </>
  );
}
