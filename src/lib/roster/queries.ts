import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { RosterArtist } from "./types";

export async function getLabelProfileForUser(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("label_profiles")
    .select(
      "id, user_id, label_name, contact_name, business_email, website, legal_business_name, logo_url, description, country"
    )
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function getLabelProfileIdForUser(userId: string): Promise<string | null> {
  const profile = await getLabelProfileForUser(userId);
  return profile?.id ?? null;
}

export async function getArtistProfileForUser(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("artist_profiles")
    .select(
      "id, user_id, stage_name, artist_name, bio, website, country, avatar_url"
    )
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function listRosterArtists(labelProfileId: string): Promise<RosterArtist[]> {
  const supabase = await createClient();
  const { data: links } = await supabase
    .from("label_roster_artists")
    .select("artist_profile_id")
    .eq("label_profile_id", labelProfileId)
    .order("created_at", { ascending: false });

  const ids = (links ?? []).map((l) => l.artist_profile_id);
  if (!ids.length) return [];

  const { data } = await supabase
    .from("artist_profiles")
    .select(
      "id, stage_name, artist_name, bio, country, genres, avatar_url, website, user_id, created_by_label_profile_id, created_at, updated_at"
    )
    .in("id", ids)
    .order("artist_name", { ascending: true });

  return (data ?? []) as RosterArtist[];
}

export async function getRosterArtist(artistProfileId: string): Promise<RosterArtist | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("artist_profiles")
    .select(
      "id, stage_name, artist_name, bio, country, genres, avatar_url, website, user_id, created_by_label_profile_id, created_at, updated_at"
    )
    .eq("id", artistProfileId)
    .maybeSingle();
  return (data as RosterArtist) ?? null;
}

export async function countReleasesForArtist(artistProfileId: string): Promise<number> {
  const map = await countReleasesForArtists([artistProfileId]);
  return map[artistProfileId] ?? 0;
}

/** Single query for a roster page — avoids N+1 counts. */
export async function countReleasesForArtists(
  artistProfileIds: string[]
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const id of artistProfileIds) counts[id] = 0;
  if (!artistProfileIds.length) return counts;

  const supabase = await createClient();
  const { data } = await supabase
    .from("releases")
    .select("artist_profile_id")
    .in("artist_profile_id", artistProfileIds);

  for (const row of data ?? []) {
    const id = row.artist_profile_id as string | null;
    if (!id) continue;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}
