import "server-only";

import { ddexConfigErrors, ddexConfigPublicStatus, readDdexConfig } from "./config";
import { DdexMappingError } from "./mapping";
import { evaluateReleaseReadiness, type ReadinessReport } from "./readiness";
import {
  downloadDdexXml,
  getDdexMessage,
  listDdexMessages,
  loadDdexSnapshot,
  sha256Utf8,
  updateDdexValidation,
} from "./persistence";
import { getDdexTransport } from "./transport";
import { getDspTarget, listDspTargets } from "./persistence";
import { configForTarget } from "./targets";
import { validateErnXml } from "./validate";
import {
  buildDdexPackage,
  generateDdexPackage,
  generateDdexRelease,
  generateDdexTakedown,
  generateDdexUpdate,
  listPublicDspTargets,
  processDdexAcknowledgment,
  queueDdexDelivery,
  retryDdexDelivery,
  sendDdexDelivery,
  validateReleaseForDdex,
} from "./service";
import type { DdexCatalogSnapshot, DdexMessageRecord } from "./types";

export async function readinessFromSnapshot(
  snapshot: DdexCatalogSnapshot,
  cfg = readDdexConfig()
): Promise<ReadinessReport> {
  // Readiness must use the same resolved DDEX target identity as generation.
  // Prefer the active local test target for validation; otherwise use an explicitly configured target.
  let runtime = cfg;
  try {
    const targets = await listDspTargets();
    const target = targets.find((t) => t.is_test && t.is_active) ?? targets.find((t) => t.is_active && !t.planning_only) ?? null;
    if (target) runtime = configForTarget(cfg, target);
  } catch {
    // Environment-only configuration remains the fallback.
  }
  return evaluateReleaseReadiness({
    upc: snapshot.release.upc,
    copyright_line: snapshot.release.copyright_line,
    phonogram_line: snapshot.release.phonogram_line,
    artist_profile_id: snapshot.release.artist_profile_id,
    primary_artist_name: snapshot.release.primary_artist_name,
    genre: snapshot.release.genre,
    territories: snapshot.release.territories,
    release_date: snapshot.release.release_date,
    tracks: snapshot.tracks,
    contributors: snapshot.contributors,
    assets: snapshot.assets,
    deals: snapshot.deals,
    senderConfigured: Boolean(runtime.senderPartyId),
    recipientConfigured: Boolean(runtime.recipientPartyId),
  });
}

export async function generateErnForRelease(
  releaseId: string,
  targetId?: string
): Promise<
  | {
      ok: true;
      message: DdexMessageRecord;
      xmlSha256: string;
      filename: string;
    }
  | { ok: false; error: string; readiness?: ReadinessReport }
> {
  const res = await generateDdexRelease(releaseId, targetId);
  if (!res.ok) {
    const snapshot = await loadDdexSnapshot(releaseId);
    return {
      ok: false,
      error: res.error,
      readiness: snapshot ? await readinessFromSnapshot(snapshot) : undefined,
    };
  }
  return {
    ok: true,
    message: res.record,
    xmlSha256: res.record.xml_sha256 || sha256Utf8(res.generated.xml),
    filename: res.generated.filename,
  };
}

export async function validateStoredErn(messageId: string): Promise<
  | { ok: true; messageId: string }
  | { ok: false; error: string }
> {
  const record = await getDdexMessage(messageId);
  if (!record) return { ok: false, error: "Message not found." };
  const xml = await downloadDdexXml(record);
  if (!xml) return { ok: false, error: "ERN XML is not in private storage." };
  const xsd = validateErnXml(xml);
  await updateDdexValidation(record.message_id, xsd);
  if (!xsd.ok) {
    return { ok: false, error: xsd.errors[0] || "XSD validation failed." };
  }
  return { ok: true, messageId: record.message_id };
}

export async function getErnDownload(messageId: string): Promise<
  | { ok: true; xml: string; filename: string }
  | { ok: false; error: string }
> {
  const record = await getDdexMessage(messageId);
  if (!record) return { ok: false, error: "Message not found." };
  const xml = await downloadDdexXml(record);
  if (!xml) return { ok: false, error: "ERN XML is not in private storage." };
  return { ok: true, xml, filename: record.filename || `${record.message_id}_ERN432.xml` };
}

/** Commercial default remains NotConnected. Local test target uses sendDdexDelivery. */
export async function deliverErn(messageId: string): Promise<{ ok: false; error: string } | { ok: true }> {
  const transport = getDdexTransport();
  const queued = await queueDdexDelivery(messageId);
  if (!queued.ok) return { ok: false, error: queued.error };
  const sent = await sendDdexDelivery(messageId);
  if (!sent.ok) {
    if (!transport.connected) {
      return { ok: false, error: sent.error };
    }
    return { ok: false, error: sent.error };
  }
  return { ok: true };
}

export {
  ddexConfigPublicStatus,
  ddexConfigErrors,
  listDdexMessages,
  loadDdexSnapshot,
  validateReleaseForDdex,
  generateDdexRelease,
  generateDdexUpdate,
  generateDdexTakedown,
  buildDdexPackage,
  generateDdexPackage,
  queueDdexDelivery,
  sendDdexDelivery,
  retryDdexDelivery,
  processDdexAcknowledgment,
  listPublicDspTargets,
  DdexMappingError,
};

