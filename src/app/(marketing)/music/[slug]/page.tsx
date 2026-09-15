import { redirect } from "next/navigation";
import { getPublicReleaseById, getPublicReleaseBySlug } from "@/lib/website/queries";
import { releaseCanonicalPath } from "@/lib/website/slugs";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

/** Legacy /music/[slug] → canonical /release/[slug] */
export default async function LegacyMusicSlugRedirect({ params }: Props) {
  const { slug } = await params;
  const bySlug = await getPublicReleaseBySlug(slug);
  if (bySlug) {
    redirect(releaseCanonicalPath(bySlug.website_slug, bySlug.id));
  }
  if (/^[0-9a-f-]{36}$/i.test(slug)) {
    const byId = await getPublicReleaseById(slug);
    if (byId) redirect(releaseCanonicalPath(byId.website_slug, byId.id));
  }
  notFound();
}
