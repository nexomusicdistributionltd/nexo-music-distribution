import { createHmac, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LOGIN_OTP_AUDIT, sanitizeOtpAuditMetadata } from "./audit";
import {
  LOGIN_OTP_PURPOSE,
  OTP_DIGITS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
} from "./constants";
import { generateOtpDigits, hashOtp, isOtpDigitString, otpHashesEqual } from "./crypto";
import { buildLoginOtpEmailHtml, loginOtpEmailSubject } from "./email-template";
import { sessionIdFromAccessToken } from "./jwt";
import { maskEmail } from "./mask";
import { isOtpPendingAllowedPath } from "./paths";
import {
  activeChallengeForSession,
  applyResendHash,
  dropVerifiedSessions,
  generationRateLimited,
  invalidateSessionChallenges,
  isSessionVerified,
  newChallengeRecord,
  resendWaitMs,
  rolesUnchanged,
  supersedePrevious,
  verifyChallenge,
  type LoginOtpChallenge,
} from "./policy";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pepper = "test-pepper-not-a-secret-for-unit-tests";

function hash(code: string, id: string) {
  return hashOtp(code, id, pepper);
}

function jwtWithSession(sessionId: string) {
  const payload = Buffer.from(
    JSON.stringify({ sub: "user", session_id: sessionId }),
    "utf8"
  ).toString("base64url");
  return `eyJhbGciOiJub25lIn0.${payload}.x`;
}

describe("OTP generator (CSPRNG)", () => {
  it("emits 6-digit codes in 000000–999999 and never uses Math.random", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const code = generateOtpDigits();
      expect(isOtpDigitString(code)).toBe(true);
      expect(code).toHaveLength(OTP_DIGITS);
      const n = Number(code);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(999999);
      seen.add(code);
    }
    expect(seen.size).toBeGreaterThan(1);
    const src = readFileSync(join(__dirname, "crypto.ts"), "utf8");
    expect(src).toContain("randomInt");
    expect(src).not.toContain("Math.random");
  });

  it("hashes with HMAC and never returns plaintext", () => {
    const id = randomUUID();
    const code = "123456";
    const h = hash(code, id);
    expect(h).toHaveLength(64);
    expect(h).not.toContain(code);
    expect(otpHashesEqual(h, hash(code, id))).toBe(true);
    expect(otpHashesEqual(h, hash("000000", id))).toBe(false);
    expect(h).toBe(createHmac("sha256", pepper).update(`${id}:${code}`).digest("hex"));
  });
});

describe("email mask + template", () => {
  it("masks registered emails for UI", () => {
    expect(maskEmail("nexomusicdistribution@gmail.com")).toBe("ne***@gmail.com");
    expect(maskEmail("a@b.co")).toBe("a***@b.co");
    expect(maskEmail("not-an-email")).toBe("***");
  });

  it("brands the login OTP email without logging hooks", () => {
    const html = buildLoginOtpEmailHtml("847291");
    expect(loginOtpEmailSubject()).toBe("Your Nexo Login Verification Code");
    expect(html).toContain("Your Nexo Login Verification Code");
    expect(html).toContain("847291");
    expect(html).toContain("10 minutes");
    expect(html).toMatch(/ignore this email/i);
    expect(html).toContain("nexomusicdistribution.com");
    expect(html).not.toContain("nexomusicdistro.space");
    const src = readFileSync(join(__dirname, "email-template.ts"), "utf8");
    expect(src).not.toContain("console.log");
  });
});

describe("session jwt", () => {
  it("reads session_id and rejects garbage", () => {
    expect(sessionIdFromAccessToken(jwtWithSession("sess-abc-12345"))).toBe("sess-abc-12345");
    expect(sessionIdFromAccessToken("nope")).toBeNull();
    expect(sessionIdFromAccessToken("")).toBeNull();
  });
});

describe("OTP challenge policy", () => {
  const user = "11111111-1111-1111-1111-111111111111";
  const sessionA = "session-aaaa-1111";
  const sessionB = "session-bbbb-2222";
  const now = 1_700_000_000_000;

  function challenge(over: Partial<LoginOtpChallenge> = {}): LoginOtpChallenge {
    const id = over.id ?? randomUUID();
    return {
      ...newChallengeRecord({
        id,
        userId: user,
        sessionId: sessionA,
        codeHash: hash("111111", id),
        now,
      }),
      ...over,
    };
  }

  it("requires a correct, unexpired, unused code before verifying THIS session", () => {
    const c = challenge();
    const good = verifyChallenge({
      challenge: c,
      presentedHash: hash("111111", c.id),
      userId: user,
      sessionId: sessionA,
      now: now + 1000,
    });
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.challenge.consumedAt).toBe(now + 1000);
      expect(good.verified.sessionId).toBe(sessionA);
      expect(isSessionVerified([good.verified], user, sessionA)).toBe(true);
      expect(isSessionVerified([good.verified], user, sessionB)).toBe(false);
    }
  });

  it("rejects incorrect codes and locks after max attempts", () => {
    let c = challenge();
    for (let i = 0; i < OTP_MAX_ATTEMPTS - 1; i++) {
      const r = verifyChallenge({
        challenge: c,
        presentedHash: hash("000000", c.id),
        userId: user,
        sessionId: sessionA,
        now: now + i,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.reason).toBe("mismatch");
        expect(r.audit).toBe("otp_failed");
        c = r.challenge;
      }
    }
    const locked = verifyChallenge({
      challenge: c,
      presentedHash: hash("000000", c.id),
      userId: user,
      sessionId: sessionA,
      now: now + 9,
    });
    expect(locked.ok).toBe(false);
    if (!locked.ok) {
      expect(locked.reason).toBe("locked");
      expect(locked.challenge.invalidatedAt).toBeTruthy();
    }
  });

  it("rejects expired and reused codes", () => {
    const c = challenge();
    const expired = verifyChallenge({
      challenge: c,
      presentedHash: hash("111111", c.id),
      userId: user,
      sessionId: sessionA,
      now: now + OTP_TTL_MS + 1,
    });
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.reason).toBe("expired");

    const consumed = challenge({ consumedAt: now + 10 });
    const reuse = verifyChallenge({
      challenge: consumed,
      presentedHash: hash("111111", consumed.id),
      userId: user,
      sessionId: sessionA,
      now: now + 20,
    });
    expect(reuse.ok).toBe(false);
    if (!reuse.ok) expect(reuse.reason).toBe("consumed");
  });

  it("does not verify a different session or grant roles", () => {
    const c = challenge();
    const wrong = verifyChallenge({
      challenge: c,
      presentedHash: hash("111111", c.id),
      userId: user,
      sessionId: sessionB,
      now: now + 1,
    });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.reason).toBe("wrong_session");
    expect(rolesUnchanged(["admin", "artist"], ["admin", "artist"])).toBe(true);
    expect(rolesUnchanged(["admin"], ["artist"])).toBe(false);
  });

  it("resend supersedes the previous hash after cooldown", () => {
    const c = challenge();
    const wait = applyResendHash(c, hash("222222", c.id), now + 1000);
    expect(wait.ok).toBe(false);
    if (!wait.ok) expect(wait.reason).toBe("cooldown");
    expect(resendWaitMs(c, now + 1000)).toBeGreaterThan(0);
    const next = applyResendHash(c, hash("222222", c.id), now + OTP_RESEND_COOLDOWN_MS);
    expect(next.ok).toBe(true);
    if (next.ok) {
      const old = verifyChallenge({
        challenge: next.challenge,
        presentedHash: hash("111111", c.id),
        userId: user,
        sessionId: sessionA,
        now: now + OTP_RESEND_COOLDOWN_MS + 1,
      });
      expect(old.ok).toBe(false);
      const fresh = verifyChallenge({
        challenge: next.challenge,
        presentedHash: hash("222222", c.id),
        userId: user,
        sessionId: sessionA,
        now: now + OTP_RESEND_COOLDOWN_MS + 1,
      });
      expect(fresh.ok).toBe(true);
    }
  });

  it("new login challenge is bound to user+session+purpose+expiry; logout invalidates", () => {
    const first = challenge();
    let list = [first];
    const second = newChallengeRecord({
      id: randomUUID(),
      userId: user,
      sessionId: sessionA,
      codeHash: hash("333333", "x"),
      now: now + 5000,
    });
    second.codeHash = hash("333333", second.id);
    list = supersedePrevious(list, user, sessionA, now + 5000, second.id);
    list.push(second);
    expect(activeChallengeForSession(list, user, sessionA, now + 6000)?.id).toBe(second.id);
    expect(list.find((c) => c.id === first.id)?.supersededAt).toBe(now + 5000);

    const verified = [{ userId: user, sessionId: sessionA, challengeId: second.id, verifiedAt: now }];
    const afterLogoutChallenges = invalidateSessionChallenges(list, user, "all", now + 7000);
    const afterLogoutVerified = dropVerifiedSessions(verified, user, "all");
    expect(afterLogoutChallenges.every((c) => c.invalidatedAt)).toBe(true);
    expect(afterLogoutVerified).toEqual([]);
    expect(activeChallengeForSession(afterLogoutChallenges, user, sessionA, now + 8000)).toBeNull();
  });

  it("rate-limits generation per user", () => {
    const many: LoginOtpChallenge[] = [];
    for (let i = 0; i < 8; i++) {
      many.push(
        newChallengeRecord({
          id: randomUUID(),
          userId: user,
          sessionId: sessionA,
          codeHash: hash("000000", String(i)),
          now: now + i,
        })
      );
    }
    expect(generationRateLimited(many, user, now + 10)).toBe(true);
    expect(generationRateLimited(many, "other-user", now + 10)).toBe(false);
  });

  it("OTP purpose is login_email_otp only (does not grant roles)", () => {
    expect(LOGIN_OTP_PURPOSE).toBe("login_email_otp");
  });
});

describe("OTP pending path allowlist", () => {
  it("blocks dashboards/admin until verified; allows auth/verify/cancel", () => {
    expect(isOtpPendingAllowedPath("/login/verify")).toBe(true);
    expect(isOtpPendingAllowedPath("/api/auth/otp/start")).toBe(true);
    expect(isOtpPendingAllowedPath("/api/auth/logout")).toBe(true);
    expect(isOtpPendingAllowedPath("/reset-password")).toBe(true);
    expect(isOtpPendingAllowedPath("/auth/confirm")).toBe(true);
    expect(isOtpPendingAllowedPath("/dashboard")).toBe(false);
    expect(isOtpPendingAllowedPath("/admin")).toBe(false);
    expect(isOtpPendingAllowedPath("/admin/users")).toBe(false);
    expect(isOtpPendingAllowedPath("/profile")).toBe(false);
  });
});

describe("audit sanitizer", () => {
  it("strips secrets and 6-digit codes", () => {
    const safe = sanitizeOtpAuditMetadata({
      challenge_id: "abc",
      otp: "123456",
      code_hash: "deadbeef",
      password: "x",
      reason: "mismatch",
    });
    expect(safe).toEqual({ challenge_id: "abc", reason: "mismatch" });
    expect(LOGIN_OTP_AUDIT.LOGIN_PASSWORD_SUCCESS).toBe("login_password_success");
    expect(LOGIN_OTP_AUDIT.OTP_SENT).toBe("otp_sent");
    expect(LOGIN_OTP_AUDIT.OTP_RESENT).toBe("otp_resent");
    expect(LOGIN_OTP_AUDIT.OTP_FAILED).toBe("otp_failed");
    expect(LOGIN_OTP_AUDIT.OTP_VERIFIED).toBe("otp_verified");
    expect(LOGIN_OTP_AUDIT.OTP_EXPIRED).toBe("otp_expired");
    expect(LOGIN_OTP_AUDIT.LOGOUT).toBe("logout");
  });
});
