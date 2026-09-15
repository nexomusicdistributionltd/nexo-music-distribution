import "server-only";

import { createSignedAssetUrl } from "@/lib/admin/queries";
import { createClient } from "@/lib/supabase/server";

/** One query + bounded signed URLs for a page of releases. */
export async function mapArtworkUrls(
  releaseIds: string[]
): Promise<Record<string, string | null>> {
  const unique = Array.from(new Set(releaseIds.filter(Boolean)));
  const result: Record<string, string | null> = {};
  for (const id of unique) result[id] = null;
  if (!unique.length) return result;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("release_assets")
    .select("release_id, storage_bucket, storage_path, created_at")
    .eq("kind", "artwork")
    .in("release_id", unique)
    .order("created_at", { ascending: false });
  if (error || !data) return result;

  const firstByRelease = new Map<string, { storage_bucket: string; storage_path: string }>();
  for (const row of data) {
    if (!firstByRelease.has(row.release_id)) {
      firstByRelease.set(row.release_id, {
        storage_bucket: row.storage_bucket,
        storage_path: row.storage_path,
      });
    }
  }

  await Promise.all(
    Array.from(firstByRelease.entries()).map(async ([id, asset]) => {
      result[id] = await createSignedAssetUrl(asset.storage_bucket, asset.storage_path, 180);
    })
  );

  return result;
}
