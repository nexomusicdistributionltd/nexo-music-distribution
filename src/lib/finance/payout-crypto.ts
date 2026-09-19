import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

export class PayoutEncryptionUnavailableError extends Error {
  constructor() {
    super("Secure payout storage is not configured.");
    this.name = "PayoutEncryptionUnavailableError";
  }
}

function encryptionKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const dedicated = (env.PAYOUT_ENCRYPTION_KEY ?? "").trim();
  if (dedicated) {
    let key: Buffer;
    if (/^[a-fA-F0-9]{64}$/.test(dedicated)) {
      key = Buffer.from(dedicated, "hex");
    } else {
      try {
        key = Buffer.from(dedicated, "base64");
      } catch {
        throw new PayoutEncryptionUnavailableError();
      }
    }
    if (key.length !== 32) throw new PayoutEncryptionUnavailableError();
    return key;
  }

  // Existing Nexo deployments already protect provider tokens with this server-only
  // encryption secret. Use a domain-separated SHA-256 derivation so payout data
  // never reuses the provider-token AES key directly.
  const existingMaster = (env.DISTRIBUTION_TOKEN_ENCRYPTION_KEY ?? "").trim();
  if (existingMaster.length < 32) throw new PayoutEncryptionUnavailableError();
  return createHash("sha256")
    .update("nexo:payout-details:v1\0", "utf8")
    .update(existingMaster, "utf8")
    .digest();
}

export function payoutEncryptionConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    encryptionKey(env);
    return true;
  } catch {
    return false;
  }
}

export function encryptPayoutPayload(value: Record<string, unknown>): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptPayoutPayload(payload: string): Record<string, unknown> {
  const [version, ivValue, tagValue, encryptedValue] = payload.split(".");
  if (version !== VERSION || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("Unsupported payout payload format.");
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(),
    Buffer.from(ivValue, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  const parsed: unknown = JSON.parse(plaintext);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid payout payload.");
  }
  return parsed as Record<string, unknown>;
}
