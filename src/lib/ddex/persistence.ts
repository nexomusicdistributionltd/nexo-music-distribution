import "server-only";

import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import type { DdexCatalogSnapshot, DdexMessageRecord } from "./types";

export const DDEX_STORAGE_BUCKET = "ddex-ern";

export function ddexStoragePath(releaseId: string, messageId: string): string {
  return `${releaseId}/${messageId}.xml`;
}

export function sha256Utf8(xml: string): string {
  return createHash("sha256").update(xml, "utf8").digest("hex");
}

export async function loadDdexSnapshot(releaseId: string): Promise<DdexCatalogSnapshot | null> {
  const supabase = await createClient();
  const { data: release, error } = await supabase
    .from("releases")
    .select("*")
    .eq("id", releaseId)
    .maybeSingle();
  if (error) throw error;
  if (!release) return null;

  const [tracks, contributors, assets, deals, artist, label] = await Promise.all([
    supabase
      .from("release_tracks")
      .select("*")
      .eq("release_id", releaseId)
      .order("track_number", { ascending: true }),
    supabase.from("release_contributors").select("*").eq("release_id", releaseId),
    supabase.from("release_assets").select("*").eq("release_id", releaseId),
    supabase.from("release_deals").select("*").eq("release_id", releaseId),
    release.artist_profile_id
      ? supabase
          .from("artist_profiles")
          .select("artist_name, stage_name")
          .eq("id", release.artist_profile_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    release.label_profile_id
      ? supabase
          .from("label_profiles")
          .select("label_name")
          .eq("id", release.label_profile_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  return {
    release,
    tracks: tracks.data ?? [],
    contributors: contributors.data ?? [],
    assets: assets.data ?? [],
    deals: deals.data ?? [],
    artistName:
      (artist.data as { artist_name?: string; stage_name?: string } | null)?.artist_name ||
      (artist.data as { stage_name?: string } | null)?.stage_name ||
      release.primary_artist_name,
    labelName:
      (label.data as { label_name?: string } | null)?.label_name || release.label_name,
  };
}

export async function listDdexMessages(releaseId?: string): Promise<DdexMessageRecord[]> {
  const supabase = await createClient();
  let q = supabase.from("ddex_messages").select("*").order("created_at", { ascending: false });
  if (releaseId) q = q.eq("release_id", releaseId);
  const { data, error } = await q.limit(200);
  if (error) throw error;
  return (data ?? []) as DdexMessageRecord[];
}

export async function getDdexMessage(messageId: string): Promise<DdexMessageRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ddex_messages")
    .select("*")
    .eq("message_id", messageId)
    .maybeSingle();
  if (error) throw error;
  return (data as DdexMessageRecord | null) ?? null;
}

export async function persistDdexMessage(input: {
  releaseId: string;
  messageId: string;
  recipientConfigKey: string;
  filename: string;
  xml: string;
  validationStatus: "valid" | "invalid";
  validationError?: string | null;
}): Promise<DdexMessageRecord> {
  const supabase = await createClient();
  const xmlSha256 = sha256Utf8(input.xml);
  const storagePath = ddexStoragePath(input.releaseId, input.messageId);

  const { error: uploadError } = await supabase.storage
    .from(DDEX_STORAGE_BUCKET)
    .upload(storagePath, Buffer.from(input.xml, "utf8"), {
      contentType: "application/xml; charset=utf-8",
      upsert: false,
    });
  if (uploadError) {
    throw new Error("Failed to store ERN XML privately.");
  }

  const { data, error } = await supabase
    .from("ddex_messages")
    .insert({
      release_id: input.releaseId,
      message_id: input.messageId,
      recipient_config_key: input.recipientConfigKey,
      message_type: "NewReleaseMessage",
      ern_version: "4.3.2",
      validation_status: input.validationStatus,
      delivery_status: "pending",
      validated_at: new Date().toISOString(),
      xml_storage_path: storagePath,
      filename: input.filename,
      xml_sha256: xmlSha256,
      avs_version_id: 9,
      release_profile: "Audio",
      error: input.validationError ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as DdexMessageRecord;
}

export async function downloadDdexXml(record: DdexMessageRecord): Promise<string | null> {
  if (!record.xml_storage_path) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(DDEX_STORAGE_BUCKET)
    .download(record.xml_storage_path);
  if (error || !data) return null;
  return await data.text();
}

export async function updateDdexValidation(
  messageId: string,
  result: { ok: boolean; errors: string[] }
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ddex_messages")
    .update({
      validation_status: result.ok ? "valid" : "invalid",
      validated_at: new Date().toISOString(),
      error: result.ok ? null : result.errors.join("\n").slice(0, 4000),
      delivery_status: "pending",
      delivered_at: null,
    })
    .eq("message_id", messageId);
  if (error) throw error;
}
