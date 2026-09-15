import "server-only";

import { ddexConfigErrors, ddexConfigPublicStatus, readDdexConfig } from "./config";
import { buildNewReleaseMessageXml } from "./builder";
import { mapCatalogToErn, DdexMappingError } from "./mapping";
import { evaluateReleaseReadiness, type ReadinessReport } from "./readiness";
import {
  downloadDdexXml,
  getDdexMessage,
  listDdexMessages,
  loadDdexSnapshot,
  persistDdexMessage,
  sha256Utf8,
  updateDdexValidation,
} from "./persistence";
import { getDdexTransport } from "./transport";
import { validateErnXml } from "./validate";
import type { DdexCatalogSnapshot, DdexMessageRecord } from "./types";

export function readinessFromSnapshot(
  snapshot: DdexCatalogSnapshot,
  cfg = readDdexConfig()
): ReadinessReport {
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
    senderConfigured: Boolean(cfg.senderPartyId),
    recipientConfigured: Boolean(cfg.recipientPartyId),
  });
}

export async function generateErnForRelease(releaseId: string): Promise<
  | {
      ok: true;
      message: DdexMessageRecord;
      xmlSha256: string;
      filename: string;
    }
  | { ok: false; error: string; readiness?: ReadinessReport }
> {
  const cfg = readDdexConfig();
  const cfgErrors = ddexConfigErrors(cfg);
  if (cfgErrors.length) {
    return { ok: false, error: cfgErrors.join(" ") };
  }

  const snapshot = await loadDdexSnapshot(releaseId);
  if (!snapshot) return { ok: false, error: "Release not found." };

  const readiness = readinessFromSnapshot(snapshot, cfg);
  if (!readiness.canGenerate) {
    return {
      ok: false,
      error: "Release is not DDEX-ready. Resolve readiness errors before generating.",
      readiness,
    };
  }

  let xml: string;
  let filename: string;
  let messageId: string;
  try {
    const model = mapCatalogToErn(snapshot, cfg);
    xml = buildNewReleaseMessageXml(model);
    filename = model.header.messageFileName;
    messageId = model.header.messageId;
  } catch (e) {
    if (e instanceof DdexMappingError) {
      return { ok: false, error: e.errors.join(" ") };
    }
    throw e;
  }

  const xsd = validateErnXml(xml);
  const record = await persistDdexMessage({
    releaseId,
    messageId,
    recipientConfigKey: cfg.recipientConfigKey,
    filename,
    xml,
    validationStatus: xsd.ok ? "valid" : "invalid",
    validationError: xsd.ok ? null : xsd.errors.join("\n"),
  });

  if (!xsd.ok) {
    return {
      ok: false,
      error: `ERN built but official XSD validation failed. Message stored as invalid. ${xsd.errors[0] ?? ""}`,
    };
  }

  return {
    ok: true,
    message: record,
    xmlSha256: sha256Utf8(xml),
    filename,
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

/** Transport stub — always refuses. Never marks DELIVERED. */
export async function deliverErn(_messageId: string): Promise<{ ok: false; error: string }> {
  void _messageId;
  const transport = getDdexTransport();
  if (!transport.connected) {
    return { ok: false, error: "DDEX transport is not connected. Delivery is unavailable." };
  }
  return { ok: false, error: "DDEX transport is not connected. Delivery is unavailable." };
}

export { ddexConfigPublicStatus, listDdexMessages, loadDdexSnapshot };
