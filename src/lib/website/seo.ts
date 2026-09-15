import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export function releaseMetadata(opts: {
  title: string;
  artist: string;
  description?: string | null;
  slugPath: string;
  image?: string | null;
}): Metadata {
  const description =
    opts.description || `${opts.title} by ${opts.artist} — ${SITE_NAME}`;
  const url = `${SITE_URL}${opts.slugPath}`;
  return {
    title: `${opts.title} · ${opts.artist}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "music.album",
      title: opts.title,
      description,
      url,
      siteName: SITE_NAME,
      ...(opts.image ? { images: [{ url: opts.image }] } : {}),
    },
    twitter: {
      card: opts.image ? "summary_large_image" : "summary",
      title: opts.title,
      description,
      ...(opts.image ? { images: [opts.image] } : {}),
    },
  };
}

export function artistMetadata(opts: {
  name: string;
  description?: string | null;
  slugPath: string;
  image?: string | null;
}): Metadata {
  const description = opts.description || `Artist profile — ${opts.name} · ${SITE_NAME}`;
  const url = `${SITE_URL}${opts.slugPath}`;
  return {
    title: opts.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      title: opts.name,
      description,
      url,
      siteName: SITE_NAME,
      ...(opts.image ? { images: [{ url: opts.image }] } : {}),
    },
    twitter: {
      card: opts.image ? "summary_large_image" : "summary",
      title: opts.name,
      description,
      ...(opts.image ? { images: [opts.image] } : {}),
    },
  };
}

export function musicAlbumJsonLd(opts: {
  name: string;
  byArtist: string;
  url: string;
  image?: string | null;
  datePublished?: string | null;
  tracks?: Array<{ name: string; position: number }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "MusicAlbum",
    name: opts.name,
    url: opts.url,
    byArtist: {
      "@type": "MusicGroup",
      name: opts.byArtist,
    },
    ...(opts.image ? { image: opts.image } : {}),
    ...(opts.datePublished ? { datePublished: opts.datePublished } : {}),
    ...(opts.tracks?.length
      ? {
          track: opts.tracks.map((t) => ({
            "@type": "MusicRecording",
            name: t.name,
            position: t.position,
          })),
        }
      : {}),
  };
}

export function musicGroupJsonLd(opts: {
  name: string;
  url: string;
  description?: string | null;
  image?: string | null;
  sameAs?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "MusicGroup",
    name: opts.name,
    url: opts.url,
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.image ? { image: opts.image } : {}),
    ...(opts.sameAs?.length ? { sameAs: opts.sameAs } : {}),
  };
}
