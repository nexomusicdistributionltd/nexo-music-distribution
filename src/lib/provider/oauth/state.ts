import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const PREFIX = "nexo_dist_v1";
const MAX_AGE_SECONDS = 10 * 60;

function signingSecret(): string {
  const secret = (process.env.DISTRIBUTION_OAUTH_STATE_SECRET ?? "").trim();
  if (!secret) throw new Error("Distribution OAuth state signing secret is not configured.");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

export function createDistributionOAuthState(): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const nonce = randomBytes(24).toString("base64url");
  const payload = `${PREFIX}.${issuedAt}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyDistributionOAuthState(state: string | null): boolean {
  if (!state) return false;
  const parts = state.split(".");
  if (parts.length !== 4 || parts[0] !== PREFIX) return false;
  const issuedAt = Number(parts[1]);
  if (!Number.isFinite(issuedAt)) return false;
  const age = Math.floor(Date.now() / 1000) - issuedAt;
  if (age < -60 || age > MAX_AGE_SECONDS) return false;
  const payload = parts.slice(0, 3).join(".");
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(parts[3]);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
