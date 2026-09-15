import { redirect, notFound } from "next/navigation";
import { getPublicArtistBySlug } from "@/lib/website/queries";
import { artistCanonicalPath } from "@/lib/website/slugs";

type Props = { params: Promise<{ slug: string }> };

/** Legacy /artists/[slug] → canonical /artist/[slug] */
export default async function LegacyArtistSlugRedirect({ params }: Props) {
  const { slug } = await params;
  const a = await getPublicArtistBySlug(slug);
  if (!a?.public_slug) notFound();
  redirect(artistCanonicalPath(a.public_slug));
}
