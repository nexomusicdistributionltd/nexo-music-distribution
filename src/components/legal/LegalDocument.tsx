import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/PageHero";
import { LegalArticle, type LegalSection } from "@/components/legal/LegalArticle";
import { BRAND_LEGAL_NAME, BRAND_PUBLIC_URL } from "@/lib/brand/social";

export function legalMetadata(input: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: `${BRAND_PUBLIC_URL}${input.path}` },
    openGraph: {
      title: `${input.title} | ${BRAND_LEGAL_NAME}`,
      description: input.description,
      url: `${BRAND_PUBLIC_URL}${input.path}`,
      siteName: BRAND_LEGAL_NAME,
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
