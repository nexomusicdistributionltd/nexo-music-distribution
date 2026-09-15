import { createHash } from "node:crypto";

export function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function md5Utf8(value: string): string {
  return createHash("md5").update(value, "utf8").digest("hex");
}

export function sha256Buffer(value: Buffer | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function md5Buffer(value: Buffer | Uint8Array): string {
  return createHash("md5").update(value).digest("hex");
}
