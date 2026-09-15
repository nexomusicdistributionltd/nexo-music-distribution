import { md5Utf8, sha256Utf8 } from "./hash";
import type {
  DdexCatalogSnapshot,
  DdexMessageSubType,
  DdexPackageFile,
  DdexPackageManifest,
} from "./types";
import { privateResourceUri, sanitizeFilenamePart } from "./filename";

export const DDEX_PACKAGE_BUCKET = "ddex-packages";

export function packageStoragePrefix(releaseId: string, messageId: string): string {
  return `${releaseId}/${messageId}`;
}

export function deliveryIdempotencyKey(input: {
  releaseId: string;
  targetId: string;
  messageSubType: DdexMessageSubType;
  xmlSha256: string;
}): string {
  return `${input.releaseId}:${input.targetId}:${input.messageSubType}:${input.xmlSha256}`;
}

export const MAX_DELIVERY_ATTEMPTS = 3;

/** Stardust-style backoff: 1m, 5m, 15m. */
export function nextRetryDelayMs(attempt: number): number {
  const steps = [60_000, 300_000, 900_000];
  return steps[Math.min(Math.max(attempt, 0), steps.length - 1)];
}

/**
 * Immutable DDEX package from already-validated ERN XML + catalog snapshot.
 * Asset hashes are copied from stored checksums — never invented.
 */
export function buildDdexPackageFromParts(input: {
  releaseId: string;
  snapshot: DdexCatalogSnapshot;
  xml: string;
  filename: string;
  messageId: string;
  messageSubType: DdexMessageSubType;
  ernVersion: string;
  targetSlug: string;
  createdAt?: string;
}): { manifest: DdexPackageManifest; xml: string; xmlSha256: string; xmlMd5: string } {
  const xmlSha256 = sha256Utf8(input.xml);
  const xmlMd5 = md5Utf8(input.xml);
  const files: DdexPackageFile[] = [
    {
      name: input.filename,
      kind: "ern",
      sha256: xmlSha256,
      md5: xmlMd5,
      sizeBytes: Buffer.byteLength(input.xml, "utf8"),
    },
  ];

  const upc = input.snapshot.release.upc?.trim();
  if (!upc) {
    throw new Error("Package build refused: UPC is missing and is never fabricated.");
  }

  for (const asset of input.snapshot.assets) {
    if (asset.kind !== "audio" && asset.kind !== "artwork") continue;
    const checksum = asset.checksum?.trim();
    if (!checksum) {
      throw new Error(
        `Package build refused: ${asset.kind} asset ${asset.filename} has no checksum (never invented).`
      );
    }
    const kind = asset.kind === "artwork" ? "image" : "audio";
    files.push({
      name: sanitizeFilenamePart(asset.filename, kind),
      kind,
      sha256: checksum,
      md5: asset.hash_algorithm?.toLowerCase() === "md5" ? checksum : "",
      sizeBytes: asset.size_bytes ?? 0,
      storagePath: asset.storage_path ? privateResourceUri(kind, asset.filename) : null,
    });
  }

  const createdAt = input.createdAt ?? new Date().toISOString();
  const manifest: DdexPackageManifest = {
    messageId: input.messageId,
    messageSubType: input.messageSubType,
    ernVersion: input.ernVersion,
    releaseId: input.releaseId,
    upc,
    targetSlug: input.targetSlug,
    createdAt,
    xmlSha256,
    files,
  };

  return { manifest, xml: input.xml, xmlSha256, xmlMd5 };
}
