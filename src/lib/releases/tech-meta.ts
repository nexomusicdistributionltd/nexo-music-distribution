/**
 * Extract technical metadata from uploaded audio/artwork buffers.
 * On failure: return nulls — never invent codec/duration/dimensions/checksum.
 */
import { createHash } from "crypto";
import { parseBuffer } from "music-metadata";
import imageSize from "image-size";

export type AudioTechMeta = {
  codec: string | null;
  container: string | null;
  sample_rate_hz: number | null;
  bit_depth: number | null;
  channels: number | null;
  duration_ms: number | null;
  checksum: string | null;
  hash_algorithm: string | null;
};

export type ArtworkTechMeta = {
  width: number | null;
  height: number | null;
  checksum: string | null;
  hash_algorithm: string | null;
};

export function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export async function extractAudioTechMeta(
  buf: Buffer,
  mimeType?: string
): Promise<AudioTechMeta> {
  const checksum = sha256Hex(buf);
  const empty: AudioTechMeta = {
    codec: null,
    container: null,
    sample_rate_hz: null,
    bit_depth: null,
    channels: null,
    duration_ms: null,
    checksum,
    hash_algorithm: "sha256",
  };
  try {
    const meta = await parseBuffer(buf, { mimeType, size: buf.length });
    const durationSec = meta.format.duration;
    return {
      codec: meta.format.codec ?? null,
      container: meta.format.container ?? null,
      sample_rate_hz: meta.format.sampleRate ?? null,
      bit_depth: meta.format.bitsPerSample ?? null,
      channels: meta.format.numberOfChannels ?? null,
      duration_ms:
        typeof durationSec === "number" && Number.isFinite(durationSec)
          ? Math.round(durationSec * 1000)
          : null,
      checksum,
      hash_algorithm: "sha256",
    };
  } catch {
    return empty;
  }
}

export function extractArtworkTechMeta(buf: Buffer): ArtworkTechMeta {
  const checksum = sha256Hex(buf);
  try {
    const dim = imageSize(buf);
    return {
      width: dim.width ?? null,
      height: dim.height ?? null,
      checksum,
      hash_algorithm: "sha256",
    };
  } catch {
    return { width: null, height: null, checksum, hash_algorithm: "sha256" };
  }
}
