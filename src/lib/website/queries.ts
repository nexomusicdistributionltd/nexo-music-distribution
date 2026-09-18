import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isPublicMusicEligible } from "./eligibility";

export type PublicReleaseCard = {
  id: string;
  title: string;
  primary_artist_name: string;
  website_slug: string | null;
  website_blurb: string | null;
  website_featured: boolean;
  website_sort_order: number;
  website_embed_spotify_url: string | null;
  website_embed_apple_url: string | null;
  website_embed_youtube_url: string | null;
  website_playback_enabled: boolean;
  website_cover_override_url: string | null;
  status: string;
  release_date: string | null;
  genre: string | null;
  release_type?: string | null;
};

const RELEASE_CARD_SELECT =
  "id, title, primary_artist_name, website_slug, website_blurb, website_featured, website_sort_order, website_embed_spotify_url, website_embed_apple_url, website_embed_youtube_url, website_playback_enabled, website_cover_override_url, website_published, status, release_date, genre, release_type";

export async function listPublicReleases(limit = 48): Promise<PublicReleaseCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("releases")
    .select(RELEASE_CARD_SELECT)
    .eq("website_published", true)
    .order("website_featured", { ascending: false })
    .order("website_sort_order", { ascending: true })
    .order("release_date", { ascending: false, nullsFirst: false })
    .limit(Math.min(100, limit));
  if (error) {
    console.error("listPublicReleases", error.message);
    return [];
  }
  return ((data ?? []) as Array<PublicReleaseCard & { website_published: boolean }>).filter(
    (r) => isPublicMusicEligible(r)
  );
}

export async function listFeaturedPublicReleases(limit = 8): Promise<PublicReleaseCard[]> {
  const all = await listPublicReleases(Math.min(48, limit * 3));
  const featured = all.filter((r) => r.website_featured);
  return (featured.length ? featured : all).slice(0, limit);
}

export async function listRecentDistributedReleases(
  limit = 8
): Promise<PublicReleaseCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("releases")
    .select(RELEASE_CARD_SELECT)
    .eq("website_published", true)
    .in("status", ["delivered", "live"])
    .order("release_date", { ascending: false, nullsFirst: false })
    .order("website_sort_order", { ascending: true })
    .limit(Math.min(48, limit));

  if (error) {
    console.error("listRecentDistributedReleases", error.message);
    return [];
  }

  return ((data ?? []) as Array<PublicReleaseCard & { website_published: boolean }>)
    .filter((release) => isPublicMusicEligible(release))
    .slice(0, limit);
}

export async function getPublicReleaseBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("releases")
    .select(
      "*, release_tracks(id, track_number, title, version, duration_ms, explicit, website_preview_enabled), release_contributors(id, name, role, track_id)"
    )
    .eq("website_slug", slug)
    .eq("website_published", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPublicReleaseById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("releases")
    .select(
      "*, release_tracks(id, track_number, title, version, duration_ms, explicit, website_preview_enabled), release_contributors(id, name, role, track_id)"
    )
    .eq("id", id)
    .eq("website_published", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type PublicArtistCard = {
  id: string;
  artist_name: string | null;
  stage_name: string | null;
  public_slug: string | null;
  public_tagline: string | null;
  public_bio_html: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  website_featured: boolean;
  website_sort_order: number;
  social_links: Record<string, string> | null;
  genres?: string[] | null;
  country?: string | null;
};

export async function listPublicArtists(limit = 48): Promise<PublicArtistCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("artist_profiles")
    .select(
      "id, artist_name, stage_name, public_slug, public_tagline, public_bio_html, avatar_url, cover_url, website_featured, website_sort_order, social_links, genres, country"
    )
    .eq("website_published", true)
    .order("website_featured", { ascending: false })
    .order("website_sort_order", { ascending: true })
    .limit(Math.min(100, limit));
  if (error) {
    console.error("listPublicArtists", error.message);
    return [];
  }
  return (data ?? []) as PublicArtistCard[];
}

export async function listFeaturedPublicArtists(limit = 8): Promise<PublicArtistCard[]> {
  const all = await listPublicArtists(Math.min(48, limit * 3));
  const featured = all.filter((a) => a.website_featured);
  return (featured.length ? featured : all).slice(0, limit);
}

export async function getPublicArtistBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("artist_profiles")
    .select(
      "id, artist_name, stage_name, public_slug, public_tagline, public_bio_html, avatar_url, cover_url, social_links, website_featured, genres, country"
    )
    .eq("public_slug", slug)
    .eq("website_published", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listPublicReleasesForArtist(
  artistName: string,
  limit = 48
): Promise<PublicReleaseCard[]> {
  const releases = await listPublicReleases(limit);
  const needle = artistName.trim().toLowerCase();
  return releases.filter((r) => r.primary_artist_name.toLowerCase() === needle);
}

export async function listRelatedPublicReleases(
  releaseId: string,
  artistName: string,
  limit = 6
): Promise<PublicReleaseCard[]> {
  const releases = await listPublicReleases(48);
  return releases
    .filter(
      (r) =>
        r.id !== releaseId &&
        r.primary_artist_name.toLowerCase() === artistName.trim().toLowerCase()
    )
    .slice(0, limit);
}

export async function listAdminWebsiteReleases(limit = 100) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("releases")
    .select(
      "id, title, primary_artist_name, status, website_published, website_featured, website_slug, website_sort_order, website_playback_enabled, website_embed_spotify_url, website_embed_apple_url, website_embed_youtube_url, website_cover_override_url, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getWebsiteSetting(key: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("website_settings")
    .select("key, value")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    console.error("getWebsiteSetting", error.message);
    return null;
  }
  return data;
}

export async function listPublishedVideos(opts?: {
  artistId?: string;
  releaseId?: string;
  limit?: number;
}) {
  const supabase = await createClient();
  let q = supabase
    .from("website_videos")
    .select(
      "id, title, url, thumbnail_url, artist_id, release_id, track_id, sort_order, published"
    )
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .limit(Math.min(50, opts?.limit ?? 24));
  if (opts?.artistId) q = q.eq("artist_id", opts.artistId);
  if (opts?.releaseId) q = q.eq("release_id", opts.releaseId);
  const { data, error } = await q;
  if (error) {
    console.error("listPublishedVideos", error.message);
    return [];
  }
  return data ?? [];
}

export async function listAdminVideos(limit = 100) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("website_videos")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
