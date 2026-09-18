import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function listCatalogMigrations(limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalog_migrations")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(Math.min(100, limit));
  if (error) throw error;
  return data ?? [];
}

export async function listCatalogMigrationHistory(limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalog_migrations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(100, limit));
  if (error) throw error;
  return data ?? [];
}

export async function getCatalogMigration(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("catalog_migrations")
    .select("*, catalog_migration_items(*), catalog_migration_conflicts(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listArtistDspMappings(artistProfileId?: string) {
  const supabase = await createClient();
  let q = supabase
    .from("artist_dsp_mappings")
    .select("*, artist_profiles(id, artist_name, stage_name, user_id)")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (artistProfileId) q = q.eq("artist_profile_id", artistProfileId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
