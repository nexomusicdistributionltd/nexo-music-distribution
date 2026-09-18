import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key(): Buffer {
  const secret = (process.env.DISTRIBUTION_TOKEN_ENCRYPTION_KEY ?? "").trim();
  if (secret.length < 32) {
    throw new Error("DISTRIBUTION_TOKEN_ENCRYPTION_KEY must be at least 32 characters.");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptDistributionSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptDistributionSecret(value: string): string {
  const [version, ivB64, tagB64, dataB64] = value.split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) throw new Error("Invalid encrypted token.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
