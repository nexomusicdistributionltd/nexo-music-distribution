import "server-only";

import { cookies } from "next/headers";
import { LOGIN_OTP_AUDIT, sanitizeOtpAuditMetadata } from "@/lib/auth/login-otp/audit";
import {
  LOGIN_OTP_PURPOSE,
  NEXO_OTP_CHALLENGE_COOKIE,
  OTP_GENERATE_MAX_PER_WINDOW,
  OTP_GENERATE_WINDOW_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
} from "@/lib/auth/login-otp/constants";
import {
  generateOtpDigits,
  hashOtp,
  isOtpDigitString,
  normalizeOtpInput,
  otpHashesEqual,
} from "@/lib/auth/login-otp/crypto";
import { buildLoginOtpEmailHtml, loginOtpEmailSubject } from "@/lib/auth/login-otp/email-template";
import { maskEmail } from "@/lib/auth/login-otp/mask";
import { getPasswordSessionIdentity, isCurrentSessionOtpVerified } from "@/lib/auth/login-otp/status";
import { homePathForRoles } from "@/lib/auth/types";
import { sendViaZohoSmtp } from "@/lib/email/zoho-smtp";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";

export { getPasswordSessionIdentity, isCurrentSessionOtpVerified } from "@/lib/auth/login-otp/status";

function otpPepper(): string {
  const pepper =
    (process.env.NEXO_OTP_PEPPER ?? "").trim() ||
    (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!pepper) {
    throw new Error("OTP pepper not configured");
  }
  return pepper;
}

async function writeOtpAudit(
  action: string,
  userId: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    const supabase = await createClient();
    await supabase.rpc("write_audit_log", {
      p_action: action,
      p_entity_type: "user",
      p_entity_id: userId,
      p_metadata: sanitizeOtpAuditMetadata(metadata),
    });
  } catch {
    /* audit must never break auth */
  }
}

export async function setOtpChallengeCookie(challengeId: string) {
  const store = await cookies();
  store.set(NEXO_OTP_CHALLENGE_COOKIE, challengeId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(OTP_TTL_MS / 1000),
  });
}

export async function clearOtpChallengeCookie() {
  const store = await cookies();
  store.set(NEXO_OTP_CHALLENGE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

type ChallengeRow = {
  id: string;
  user_id: string;
  session_id: string;
  purpose: string;
  code_hash: string;
  created_at: string;
  expires_at: string;
  last_sent_at: string;
  attempt_count: number;
  consumed_at: string | null;
  superseded_at: string | null;
  invalidated_at: string | null;
};

async function loadActiveChallenge(userId: string, sessionId: string): Promise<ChallengeRow | null> {
  const service = createServiceClient();
  const { data } = await service
    .from("login_otp_challenges")
    .select("*")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .eq("purpose", LOGIN_OTP_PURPOSE)
    .is("consumed_at", null)
    .is("superseded_at", null)
    .is("invalidated_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ChallengeRow | null) ?? null;
}

async function supersedeActive(userId: string, sessionId: string, exceptId?: string) {
  const service = createServiceClient();
  let q = service
    .from("login_otp_challenges")
    .update({
      superseded_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .is("consumed_at", null)
    .is("superseded_at", null)
    .is("invalidated_at", null);
  if (exceptId) q = q.neq("id", exceptId);
  await q;
}

function publicStartResult(opts: {
  challengeId: string;
  email: string;
  expiresAt: string;
  lastSentAt: string;
  resent?: boolean;
}) {
  const last = new Date(opts.lastSentAt).getTime();
  const resendAt = last + OTP_RESEND_COOLDOWN_MS;
  return {
    ok: true as const,
    challengeId: opts.challengeId,
    maskedEmail: maskEmail(opts.email),
    expiresAt: opts.expiresAt,
    resendAvailableAt: new Date(resendAt).toISOString(),
    resent: Boolean(opts.resent),
  };
}

export type OtpStartResult =
  | (ReturnType<typeof publicStartResult> & { alreadyVerified?: boolean })
  | { ok: false; error: string; status: number };

async function countRecentGenerations(userId: string): Promise<number> {
  const service = createServiceClient();
  const since = new Date(Date.now() - OTP_GENERATE_WINDOW_MS).toISOString();
  const { count, error } = await service
    .from("login_otp_challenges")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) return OTP_GENERATE_MAX_PER_WINDOW;
  return count ?? OTP_GENERATE_MAX_PER_WINDOW;
}

async function sendOtpEmail(to: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sent = await sendViaZohoSmtp({
    to,
    subject: loginOtpEmailSubject(),
    html: buildLoginOtpEmailHtml(code),
  });
  if (!sent.ok) return { ok: false, error: sent.error };
  return { ok: true };
}

/**
 * Create a new OTP challenge for THIS supabase session and email it to the
 * registered account address only. Zoho failure does not grant access.
 */
export async function startLoginOtp(opts?: {
  resend?: boolean;
  auditPasswordSuccess?: boolean;
  entry?: string;
}): Promise<OtpStartResult> {
  const identity = await getPasswordSessionIdentity();
  if (!identity) {
    return { ok: false, error: "Please sign in to continue.", status: 401 };
  }
  if (!identity.emailConfirmed) {
    return { ok: false, error: "Please verify your email before signing in.", status: 403 };
  }

  if (await isCurrentSessionOtpVerified()) {
    return {
      ok: true as const,
      challengeId: "",
      maskedEmail: maskEmail(identity.email),
      expiresAt: new Date().toISOString(),
      resendAvailableAt: new Date().toISOString(),
      resent: false,
      alreadyVerified: true,
    };
  }

  const existing = await loadActiveChallenge(identity.userId, identity.sessionId);

  if (!opts?.resend && existing) {
    const remaining = new Date(existing.expires_at).getTime() - Date.now();
    if (remaining > 0) {
      return publicStartResult({
        challengeId: existing.id,
        email: identity.email,
        expiresAt: existing.expires_at,
        lastSentAt: existing.last_sent_at,
      });
    }
  }

  if ((await countRecentGenerations(identity.userId)) >= OTP_GENERATE_MAX_PER_WINDOW) {
    return { ok: false, error: "Too many verification codes. Please wait and try again.", status: 429 };
  }

  if (opts?.resend && existing) {
    const wait = new Date(existing.last_sent_at).getTime() + OTP_RESEND_COOLDOWN_MS - Date.now();
    if (wait > 0) {
      return {
        ok: false,
        error: "Please wait before requesting a new code.",
        status: 429,
      };
    }
  }

  if (opts?.auditPasswordSuccess) {
    await writeOtpAudit(LOGIN_OTP_AUDIT.LOGIN_PASSWORD_SUCCESS, identity.userId, {
      method: "password",
      ...(opts.entry ? { entry: opts.entry } : {}),
    });
  }

  const challengeId = randomUUID();
  const code = generateOtpDigits();
  let codeHash: string;
  try {
    codeHash = hashOtp(code, challengeId, otpPepper());
  } catch {
    return { ok: false, error: "Verification is temporarily unavailable.", status: 503 };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS).toISOString();

  await supersedeActive(identity.userId, identity.sessionId);

  const service = createServiceClient();
  const { error: insertError } = await service.from("login_otp_challenges").insert({
    id: challengeId,
    user_id: identity.userId,
    session_id: identity.sessionId,
    purpose: LOGIN_OTP_PURPOSE,
    code_hash: codeHash,
    created_at: now.toISOString(),
    expires_at: expiresAt,
    last_sent_at: now.toISOString(),
    attempt_count: 0,
  });

  if (insertError) {
    return { ok: false, error: "Could not start verification.", status: 500 };
  }

  const sent = await sendOtpEmail(identity.email, code);
  if (!sent.ok) {
    await service
      .from("login_otp_challenges")
      .update({ invalidated_at: new Date().toISOString(), superseded_at: new Date().toISOString() })
      .eq("id", challengeId);
    await writeOtpAudit(LOGIN_OTP_AUDIT.OTP_FAILED, identity.userId, {
      reason: "send_failed",
      resent: Boolean(opts?.resend),
    });
    return {
      ok: false,
      error: "We could not send a verification code. Try again in a moment.",
      status: 503,
    };
  }

  await writeOtpAudit(
    opts?.resend ? LOGIN_OTP_AUDIT.OTP_RESENT : LOGIN_OTP_AUDIT.OTP_SENT,
    identity.userId,
    { challenge_id: challengeId, resent: Boolean(opts?.resend) }
  );

  await setOtpChallengeCookie(challengeId);

  return publicStartResult({
    challengeId,
    email: identity.email,
    expiresAt,
    lastSentAt: now.toISOString(),
    resent: Boolean(opts?.resend),
  });
}

export type OtpVerifyResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string; status: number; locked?: boolean };

export async function verifyLoginOtp(rawCode: string): Promise<OtpVerifyResult> {
  const identity = await getPasswordSessionIdentity();
  if (!identity) {
    return { ok: false, error: "Please sign in to continue.", status: 401 };
  }

  if (await isCurrentSessionOtpVerified()) {
    return { ok: true, redirectTo: homePathForRoles(identity.roles) };
  }

  const code = normalizeOtpInput(rawCode);
  if (!isOtpDigitString(code)) {
    return { ok: false, error: "Enter the 6-digit code from your email.", status: 400 };
  }

  const row = await loadActiveChallenge(identity.userId, identity.sessionId);
  if (!row) {
    await writeOtpAudit(LOGIN_OTP_AUDIT.OTP_FAILED, identity.userId, { reason: "no_challenge" });
    return { ok: false, error: "This code is no longer valid. Request a new one.", status: 400 };
  }

  const service = createServiceClient();
  const now = Date.now();
  const expiresAt = new Date(row.expires_at).getTime();

  if (now >= expiresAt) {
    await service
      .from("login_otp_challenges")
      .update({ invalidated_at: new Date().toISOString() })
      .eq("id", row.id);
    await writeOtpAudit(LOGIN_OTP_AUDIT.OTP_EXPIRED, identity.userId, { challenge_id: row.id });
    return { ok: false, error: "This code has expired. Request a new one.", status: 400 };
  }

  if (row.attempt_count >= OTP_MAX_ATTEMPTS) {
    await service
      .from("login_otp_challenges")
      .update({ invalidated_at: new Date().toISOString() })
      .eq("id", row.id);
    await writeOtpAudit(LOGIN_OTP_AUDIT.OTP_FAILED, identity.userId, {
      reason: "locked",
      challenge_id: row.id,
    });
    return { ok: false, error: "Too many incorrect codes. Sign in again.", status: 423, locked: true };
  }

  let presented: string;
  try {
    presented = hashOtp(code, row.id, otpPepper());
  } catch {
    return { ok: false, error: "Verification is temporarily unavailable.", status: 503 };
  }

  if (!otpHashesEqual(row.code_hash, presented)) {
    const nextAttempts = row.attempt_count + 1;
    const locked = nextAttempts >= OTP_MAX_ATTEMPTS;
    await service
      .from("login_otp_challenges")
      .update({
        attempt_count: nextAttempts,
        invalidated_at: locked ? new Date().toISOString() : null,
      })
      .eq("id", row.id);
    await writeOtpAudit(LOGIN_OTP_AUDIT.OTP_FAILED, identity.userId, {
      reason: locked ? "locked" : "mismatch",
      challenge_id: row.id,
      attempts: nextAttempts,
    });
    if (locked) {
      return { ok: false, error: "Too many incorrect codes. Sign in again.", status: 423, locked: true };
    }
    return { ok: false, error: "That code is incorrect. Try again.", status: 400 };
  }

  const verifiedAt = new Date().toISOString();
  await service
    .from("login_otp_challenges")
    .update({ consumed_at: verifiedAt })
    .eq("id", row.id);

  const { error: upsertError } = await service.from("login_otp_verified_sessions").upsert(
    {
      user_id: identity.userId,
      session_id: identity.sessionId,
      challenge_id: row.id,
      verified_at: verifiedAt,
    },
    { onConflict: "user_id,session_id" }
  );

  if (upsertError) {
    await writeOtpAudit(LOGIN_OTP_AUDIT.OTP_FAILED, identity.userId, { reason: "persist_failed" });
    return { ok: false, error: "Could not complete verification.", status: 500 };
  }

  await writeOtpAudit(LOGIN_OTP_AUDIT.OTP_VERIFIED, identity.userId, { challenge_id: row.id });
  await clearOtpChallengeCookie();

  return { ok: true, redirectTo: homePathForRoles(identity.roles) };
}

export async function logoutNexoSession(): Promise<void> {
  const identity = await getPasswordSessionIdentity().catch(() => null);
  try {
    const supabase = await createClient();
    try {
      await supabase.rpc("nexo_login_otp_invalidate_current");
    } catch {
      /* continue */
    }
    if (identity) {
      await writeOtpAudit(LOGIN_OTP_AUDIT.LOGOUT, identity.userId, {});
    } else {
      try {
        await supabase.rpc("write_audit_log", {
          p_action: LOGIN_OTP_AUDIT.LOGOUT,
          p_entity_type: "user",
          p_entity_id: null,
          p_metadata: {},
        });
      } catch {
        /* ignore */
      }
    }
    try {
      const service = createServiceClient();
      if (identity) {
        await service
          .from("login_otp_challenges")
          .update({
            invalidated_at: new Date().toISOString(),
            superseded_at: new Date().toISOString(),
          })
          .eq("user_id", identity.userId)
          .is("consumed_at", null);
        await service.from("login_otp_verified_sessions").delete().eq("user_id", identity.userId);
      }
    } catch {
      /* service role optional for logout */
    }
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    /* still clear cookies */
  }
  await clearOtpChallengeCookie();
}
