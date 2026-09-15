import {
  LOGIN_OTP_PURPOSE,
  OTP_GENERATE_MAX_PER_WINDOW,
  OTP_GENERATE_WINDOW_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  type LoginOtpPurpose,
} from "@/lib/auth/login-otp/constants";
import { otpHashesEqual } from "@/lib/auth/login-otp/crypto";

export type LoginOtpChallenge = {
  id: string;
  userId: string;
  sessionId: string;
  purpose: LoginOtpPurpose;
  codeHash: string;
  createdAt: number;
  expiresAt: number;
  lastSentAt: number;
  attemptCount: number;
  consumedAt: number | null;
  supersededAt: number | null;
  invalidatedAt: number | null;
};

export type LoginOtpVerifiedSession = {
  userId: string;
  sessionId: string;
  challengeId: string;
  verifiedAt: number;
};

export type ChallengeFailReason =
  | "expired"
  | "consumed"
  | "invalidated"
  | "superseded"
  | "mismatch"
  | "locked"
  | "wrong_session"
  | "wrong_user"
  | "wrong_purpose";

export function isChallengeActive(c: LoginOtpChallenge, now: number): boolean {
  return (
    c.consumedAt == null &&
    c.supersededAt == null &&
    c.invalidatedAt == null &&
    now < c.expiresAt
  );
}

export function activeChallengeForSession(
  challenges: LoginOtpChallenge[],
  userId: string,
  sessionId: string,
  now: number,
  purpose: LoginOtpPurpose = LOGIN_OTP_PURPOSE
): LoginOtpChallenge | null {
  const matches = challenges
    .filter(
      (c) =>
        c.userId === userId &&
        c.sessionId === sessionId &&
        c.purpose === purpose &&
        isChallengeActive(c, now)
    )
    .sort((a, b) => b.createdAt - a.createdAt);
  return matches[0] ?? null;
}

export function isSessionVerified(
  rows: LoginOtpVerifiedSession[],
  userId: string,
  sessionId: string
): boolean {
  return rows.some((r) => r.userId === userId && r.sessionId === sessionId);
}

export function generationRateLimited(
  challenges: LoginOtpChallenge[],
  userId: string,
  now: number
): boolean {
  const since = now - OTP_GENERATE_WINDOW_MS;
  const n = challenges.filter((c) => c.userId === userId && c.createdAt >= since).length;
  return n >= OTP_GENERATE_MAX_PER_WINDOW;
}

export function resendWaitMs(challenge: LoginOtpChallenge, now: number): number {
  const wait = challenge.lastSentAt + OTP_RESEND_COOLDOWN_MS - now;
  return wait > 0 ? wait : 0;
}

export function newChallengeRecord(input: {
  id: string;
  userId: string;
  sessionId: string;
  codeHash: string;
  now: number;
  purpose?: LoginOtpPurpose;
}): LoginOtpChallenge {
  return {
    id: input.id,
    userId: input.userId,
    sessionId: input.sessionId,
    purpose: input.purpose ?? LOGIN_OTP_PURPOSE,
    codeHash: input.codeHash,
    createdAt: input.now,
    expiresAt: input.now + OTP_TTL_MS,
    lastSentAt: input.now,
    attemptCount: 0,
    consumedAt: null,
    supersededAt: null,
    invalidatedAt: null,
  };
}

/** Mark prior active challenges for this user+session+purpose as superseded. */
export function supersedePrevious(
  challenges: LoginOtpChallenge[],
  userId: string,
  sessionId: string,
  now: number,
  exceptId?: string
): LoginOtpChallenge[] {
  return challenges.map((c) => {
    if (
      c.userId === userId &&
      c.sessionId === sessionId &&
      c.purpose === LOGIN_OTP_PURPOSE &&
      c.id !== exceptId &&
      c.consumedAt == null &&
      c.supersededAt == null &&
      c.invalidatedAt == null
    ) {
      return { ...c, supersededAt: now };
    }
    return c;
  });
}

export function invalidateSessionChallenges(
  challenges: LoginOtpChallenge[],
  userId: string,
  sessionId: string | "all",
  now: number
): LoginOtpChallenge[] {
  return challenges.map((c) => {
    if (c.userId !== userId) return c;
    if (sessionId !== "all" && c.sessionId !== sessionId) return c;
    if (c.consumedAt || c.invalidatedAt) return c;
    return { ...c, invalidatedAt: now, supersededAt: c.supersededAt ?? now };
  });
}

export function dropVerifiedSessions(
  rows: LoginOtpVerifiedSession[],
  userId: string,
  sessionId: string | "all"
): LoginOtpVerifiedSession[] {
  return rows.filter((r) => {
    if (r.userId !== userId) return true;
    if (sessionId === "all") return false;
    return r.sessionId !== sessionId;
  });
}

export type VerifyOutcome =
  | { ok: true; challenge: LoginOtpChallenge; verified: LoginOtpVerifiedSession }
  | { ok: false; reason: ChallengeFailReason; challenge: LoginOtpChallenge; audit: "otp_failed" | "otp_expired" };

export function verifyChallenge(input: {
  challenge: LoginOtpChallenge;
  presentedHash: string;
  userId: string;
  sessionId: string;
  now: number;
}): VerifyOutcome {
  const { challenge, presentedHash, userId, sessionId, now } = input;

  if (challenge.userId !== userId) {
    return { ok: false, reason: "wrong_user", challenge, audit: "otp_failed" };
  }
  if (challenge.sessionId !== sessionId) {
    return { ok: false, reason: "wrong_session", challenge, audit: "otp_failed" };
  }
  if (challenge.purpose !== LOGIN_OTP_PURPOSE) {
    return { ok: false, reason: "wrong_purpose", challenge, audit: "otp_failed" };
  }
  if (challenge.invalidatedAt != null) {
    return { ok: false, reason: "invalidated", challenge, audit: "otp_failed" };
  }
  if (challenge.supersededAt != null) {
    return { ok: false, reason: "superseded", challenge, audit: "otp_failed" };
  }
  if (challenge.consumedAt != null) {
    return { ok: false, reason: "consumed", challenge, audit: "otp_failed" };
  }
  if (now >= challenge.expiresAt) {
    const expired: LoginOtpChallenge = {
      ...challenge,
      invalidatedAt: now,
    };
    return { ok: false, reason: "expired", challenge: expired, audit: "otp_expired" };
  }
  if (challenge.attemptCount >= OTP_MAX_ATTEMPTS) {
    const locked: LoginOtpChallenge = {
      ...challenge,
      invalidatedAt: now,
    };
    return { ok: false, reason: "locked", challenge: locked, audit: "otp_failed" };
  }

  const match = otpHashesEqual(challenge.codeHash, presentedHash);
  if (!match) {
    const attemptCount = challenge.attemptCount + 1;
    const locked = attemptCount >= OTP_MAX_ATTEMPTS;
    const next: LoginOtpChallenge = {
      ...challenge,
      attemptCount,
      invalidatedAt: locked ? now : challenge.invalidatedAt,
    };
    return {
      ok: false,
      reason: locked ? "locked" : "mismatch",
      challenge: next,
      audit: "otp_failed",
    };
  }

  const consumed: LoginOtpChallenge = {
    ...challenge,
    consumedAt: now,
  };
  return {
    ok: true,
    challenge: consumed,
    verified: {
      userId,
      sessionId,
      challengeId: challenge.id,
      verifiedAt: now,
    },
  };
}

export function applyResendHash(
  challenge: LoginOtpChallenge,
  newHash: string,
  now: number
): { ok: true; challenge: LoginOtpChallenge } | { ok: false; reason: "cooldown" | "inactive"; waitMs: number } {
  if (!isChallengeActive(challenge, now) && challenge.consumedAt) {
    return { ok: false, reason: "inactive", waitMs: 0 };
  }
  if (challenge.consumedAt || challenge.invalidatedAt) {
    return { ok: false, reason: "inactive", waitMs: 0 };
  }
  const wait = resendWaitMs(challenge, now);
  if (wait > 0) {
    return { ok: false, reason: "cooldown", waitMs: wait };
  }
  return {
    ok: true,
    challenge: {
      ...challenge,
      codeHash: newHash,
      expiresAt: now + OTP_TTL_MS,
      lastSentAt: now,
      attemptCount: 0,
      supersededAt: null,
      invalidatedAt: null,
      consumedAt: null,
    },
  };
}

/** OTP success must not invent or change application roles. */
export function rolesUnchanged<T extends string>(before: readonly T[], after: readonly T[]): boolean {
  if (before.length !== after.length) return false;
  const a = [...before].sort();
  const b = [...after].sort();
  return a.every((v, i) => v === b[i]);
}
