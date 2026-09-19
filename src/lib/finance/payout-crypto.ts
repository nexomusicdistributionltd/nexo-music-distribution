import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

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
  const raw = (env.PAYOUT_ENCRYPTION_KEY ?? "").trim();
  if (!raw) throw new PayoutEncryptionUnavailableError();

  let key: Buffer;
  if (/^[a-fA-F0-9]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    try {
      key = Buffer.from(raw, "base64");
    } catch {
      throw new PayoutEncryptionUnavailableError();
    }
  }
  if (key.length !== 32) throw new PayoutEncryptionUnavailableError();
  return key;
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
