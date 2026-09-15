import "server-only";

import { createClient } from "@/lib/supabase/server";
import { sha256Utf8 } from "./hash";
import { DDEX_PACKAGE_BUCKET, packageStoragePrefix } from "./package-builder";
import type {
  DdexCatalogSnapshot,
  DdexErnVersion,
  DdexMessageRecord,
  DdexMessageSubType,
  DdexPackageManifest,
  DspTargetRow,
  OwnerDdexStatusRow,
} from "./types";

export const DDEX_STORAGE_BUCKET = "ddex-ern";
export { sha256Utf8 };

export function ddexStoragePath(releaseId: string, messageId: string): string {
  return `${releaseId}/${messageId}.xml`;
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
  targetId?: string | null;
  messageSubType?: DdexMessageSubType;
  messageThreadId?: string | null;
  ernVersion?: DdexErnVersion;
  validationReport?: unknown;
  idempotencyKey?: string | null;
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
      ern_version: input.ernVersion ?? "4.3.2",
      validation_status: input.validationStatus,
      delivery_status: "pending",
      validated_at: new Date().toISOString(),
      xml_storage_path: storagePath,
      filename: input.filename,
      xml_sha256: xmlSha256,
      avs_version_id: 9,
      release_profile: "Audio",
      error: input.validationError ?? null,
      target_id: input.targetId ?? null,
      message_subtype: input.messageSubType ?? "Initial",
      message_thread_id: input.messageThreadId ?? input.messageId,
      validation_report: input.validationReport ?? null,
      idempotency_key: input.idempotencyKey ?? null,
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

export async function listDspTargets(): Promise<DspTargetRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("dsp_targets").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DspTargetRow[];
}

export async function getDspTarget(idOrSlug: string): Promise<DspTargetRow | null> {
  const supabase = await createClient();
  const looksLikeId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  if (looksLikeId) {
    const byId = await supabase.from("dsp_targets").select("*").eq("id", idOrSlug).maybeSingle();
    if (byId.error) throw byId.error;
    if (byId.data) return byId.data as DspTargetRow;
  }
  const bySlug = await supabase.from("dsp_targets").select("*").eq("slug", idOrSlug).maybeSingle();
  if (bySlug.error) throw bySlug.error;
  return (bySlug.data as DspTargetRow | null) ?? null;
}

export async function storeValidationRun(input: {
  releaseId: string;
  targetId?: string | null;
  canGenerate: boolean;
  report: unknown;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("ddex_validation_runs").insert({
    release_id: input.releaseId,
    target_id: input.targetId ?? null,
    can_generate: input.canGenerate,
    report: input.report ?? {},
  });
  if (error) throw error;
}

export async function persistDdexPackage(input: {
  record: DdexMessageRecord;
  manifest: DdexPackageManifest;
  xml: string;
  filename: string;
}): Promise<{ packageStoragePath: string; packageSha256: string }> {
  const supabase = await createClient();
  const prefix = packageStoragePrefix(input.record.release_id, input.record.message_id);
  const manifestJson = JSON.stringify(input.manifest, null, 2);
  const packageSha256 = sha256Utf8(manifestJson);
  const xmlPath = `${prefix}/${input.filename}`;
  const manifestPath = `${prefix}/manifest.json`;

  const xmlUpload = await supabase.storage.from(DDEX_PACKAGE_BUCKET).upload(
    xmlPath,
    Buffer.from(input.xml, "utf8"),
    { contentType: "application/xml; charset=utf-8", upsert: true }
  );
  if (xmlUpload.error) throw new Error("Failed to store DDEX package XML privately.");
  const manUpload = await supabase.storage.from(DDEX_PACKAGE_BUCKET).upload(
    manifestPath,
    Buffer.from(manifestJson, "utf8"),
    { contentType: "application/json; charset=utf-8", upsert: true }
  );
  if (manUpload.error) throw new Error("Failed to store DDEX package manifest privately.");

  const { error } = await supabase
    .from("ddex_messages")
    .update({
      package_status: "ready_for_delivery",
      package_storage_path: prefix,
      package_sha256: packageSha256,
      delivery_status: "ready_for_delivery",
    })
    .eq("message_id", input.record.message_id);
  if (error) throw error;
  return { packageStoragePath: prefix, packageSha256 };
}

export async function updateDdexMessage(
  messageId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("ddex_messages").update(patch).eq("message_id", messageId);
  if (error) throw error;
}

export async function insertDeliveryAttempt(input: {
  messageId: string;
  attempt: number;
  protocol: string;
  status: "sending" | "delivered" | "failed";
  error?: string | null;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("ddex_delivery_attempts").insert({
    message_id: input.messageId,
    attempt: input.attempt,
    protocol: input.protocol,
    status: input.status,
    error: input.error ?? null,
  });
  if (error) throw error;
}

export async function insertAcknowledgment(input: {
  messageId: string;
  ackType?: string;
  ackReference: string;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("ddex_acknowledgments").insert({
    message_id: input.messageId,
    ack_type: input.ackType ?? "manual",
    ack_reference: input.ackReference,
  });
  if (error) throw error;
}

export async function listOwnerDdexStatus(releaseId: string): Promise<OwnerDdexStatusRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_owner_ddex_status", { p_release_id: releaseId });
  if (error) throw error;
  return (data ?? []) as OwnerDdexStatusRow[];
}

export async function findMessageByIdempotency(key: string): Promise<DdexMessageRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ddex_messages")
    .select("*")
    .eq("idempotency_key", key)
    .maybeSingle();
  if (error) throw error;
  return (data as DdexMessageRecord | null) ?? null;
}

export async function latestThreadMessage(
  releaseId: string,
  targetId: string
): Promise<DdexMessageRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ddex_messages")
    .select("*")
    .eq("release_id", releaseId)
    .eq("target_id", targetId)
    .in("message_subtype", ["Initial", "Update"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as DdexMessageRecord | null) ?? null;
}
