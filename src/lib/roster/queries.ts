import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { RosterArtist } from "./types";

export async function getLabelProfileIdForUser(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("label_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
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
  const supabase = await createClient();
  const { count } = await supabase
    .from("releases")
    .select("id", { count: "exact", head: true })
    .eq("artist_profile_id", artistProfileId);
  return count ?? 0;
}
