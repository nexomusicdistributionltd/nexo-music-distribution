import type { ReactNode } from "react";
import { PageHero } from "@/components/marketing/PageHero";
import { SafeHtml } from "@/components/cms/SafeHtml";
import { getPublishedPageBySlug } from "@/lib/cms/pages";

export async function CmsManagedLegalPage({
  slug,
  fallback,
}: {
  slug: string;
  fallback: ReactNode;
}) {
  const page = await getPublishedPageBySlug(slug);
  if (!page) return <>{fallback}</>;

  return (
    <>
      <PageHero
        eyebrow="Legal"
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
