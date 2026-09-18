import "server-only";
import type { Metadata } from "next";
import { getPublishedPageBySlug } from "@/lib/cms/pages";
import { SITE_URL } from "@/lib/site";

export async function cmsLegalMetadata({
  slug,
  path,
  fallback,
}: {
  slug: string;
  path: string;
  fallback: Metadata;
}): Promise<Metadata> {
  const page = await getPublishedPageBySlug(slug);
  if (!page) return fallback;

  return {
    ...fallback,
    title: page.seo_title || page.title,
    description: page.seo_description || fallback.description,
    alternates: { canonical: `${SITE_URL}${path}` },
  };
}
