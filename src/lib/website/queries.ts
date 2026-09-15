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
};

export async function listPublicReleases(limit = 48): Promise<PublicReleaseCard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("releases")
    .select(
      "id, title, primary_artist_name, website_slug, website_blurb, website_featured, website_sort_order, website_embed_spotify_url, website_embed_apple_url, website_embed_youtube_url, website_playback_enabled, website_cover_override_url, website_published, status, release_date, genre"
    )
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

export async function getPublicReleaseBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("releases")
    .select(
      "*, release_tracks(id, track_number, title, version, duration_ms, explicit, website_preview_enabled)"
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
      "*, release_tracks(id, track_number, title, version, duration_ms, explicit, website_preview_enabled)"
    )
    .eq("id", id)
    .eq("website_published", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listPublicArtists(limit = 48) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("artist_profiles")
    .select(
      "id, artist_name, stage_name, public_slug, public_tagline, public_bio_html, avatar_url, cover_url, website_featured, website_sort_order, social_links"
    )
    .eq("website_published", true)
    .order("website_featured", { ascending: false })
    .order("website_sort_order", { ascending: true })
    .limit(Math.min(100, limit));
  if (error) {
    console.error("listPublicArtists", error.message);
    return [];
  }
  return data ?? [];
}

export async function getPublicArtistBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("artist_profiles")
    .select(
      "id, artist_name, stage_name, public_slug, public_tagline, public_bio_html, avatar_url, cover_url, social_links, website_featured"
    )
    .eq("public_slug", slug)
    .eq("website_published", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listAdminWebsiteReleases(limit = 100) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("releases")
    .select(
      "id, title, primary_artist_name, status, website_published, website_featured, website_slug, website_sort_order, website_playback_enabled, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
