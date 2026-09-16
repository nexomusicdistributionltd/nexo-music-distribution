/**
 * Simple in-memory rate limiter (edge/node safe within a single instance).
 * Fail-closed gracefully: when over limit → deny; on internal error → deny.
 * No paid Redis required. Suitable for contact/support/webhooks/mutations.
 */

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; remaining: 0; resetAt: number; retryAfterSec: number };

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

const MAX_KEYS = 20_000;

function pruneIfNeeded(now: number) {
  if (store.size < MAX_KEYS) return;
  for (const [k, v] of store) {
    if (v.resetAt <= now) store.delete(k);
  }
  if (store.size >= MAX_KEYS) {
    // Drop oldest half by resetAt
    const entries = [...store.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (let i = 0; i < Math.ceil(entries.length / 2); i++) {
      store.delete(entries[i][0]);
    }
  }
}

export function checkRateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): RateLimitResult {
  try {
    const now = options.now ?? Date.now();
    const limit = Math.max(1, options.limit);
    const windowMs = Math.max(1000, options.windowMs);
    pruneIfNeeded(now);

    const existing = store.get(options.key);
    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowMs;
      store.set(options.key, { count: 1, resetAt });
      return { ok: true, remaining: limit - 1, resetAt };
    }

    if (existing.count >= limit) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      return { ok: false, remaining: 0, resetAt: existing.resetAt, retryAfterSec };
    }

    existing.count += 1;
    store.set(options.key, existing);
    return { ok: true, remaining: limit - existing.count, resetAt: existing.resetAt };
  } catch {
    // Fail closed
    const resetAt = Date.now() + 60_000;
    return { ok: false, remaining: 0, resetAt, retryAfterSec: 60 };
  }
}

/** Client IP best-effort (trust proxy headers only behind known edge). */
export function clientIpFromRequest(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  return "unknown";
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
    ...(result.ok
      ? {}
      : { "Retry-After": String(result.retryAfterSec) }),
  };
}

/** Presets used across Batch 8 surfaces */
export const RATE_LIMITS = {
  contact: { limit: 5, windowMs: 15 * 60_000 },
  newsletter: { limit: 8, windowMs: 15 * 60_000 },
  supportTicket: { limit: 10, windowMs: 60 * 60_000 },
  supportReply: { limit: 30, windowMs: 60 * 60_000 },
  releaseSubmit: { limit: 20, windowMs: 60 * 60_000 },
  assetUpload: { limit: 60, windowMs: 60 * 60_000 },
  payoutCreate: { limit: 10, windowMs: 60 * 60_000 },
  portalRequest: { limit: 30, windowMs: 60 * 60_000 },
  royaltyImport: { limit: 30, windowMs: 60 * 60_000 },
  webhook: { limit: 120, windowMs: 60_000 },
  adminMutation: { limit: 60, windowMs: 60_000 },
  authSensitive: { limit: 20, windowMs: 15 * 60_000 },
  otpGenerate: { limit: 8, windowMs: 15 * 60_000 },
  otpVerify: { limit: 12, windowMs: 15 * 60_000 },
} as const;

/** Test helper */
export function __resetRateLimitStoreForTests() {
  store.clear();
}
