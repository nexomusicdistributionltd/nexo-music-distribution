import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/PageHero";
import { LegalArticle, type LegalSection } from "@/components/legal/LegalArticle";
import { SITE_URL } from "@/lib/site";

export function legalMetadata(input: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: `${SITE_URL}${input.path}` },
    openGraph: {
      title: `${input.title} | NEXO Music Distribution`,
      description: input.description,
      url: `${SITE_URL}${input.path}`,
      siteName: "NEXO Music Distribution",
      type: "article",
    },
  };
}

export function LegalDocument({
  title,
  crumb,
  updated,
  sections,
  description,
}: {
  title: string;
  crumb: string;
  updated: string;
  sections: LegalSection[];
  description?: string;
}) {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title={title}
        description={description}
        crumbs={[{ label: "Home", href: "/" }, { label: crumb }]}
        showAside={false}
      />
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <LegalArticle updated={updated} sections={sections} />
      </section>
    </>
  );
}
