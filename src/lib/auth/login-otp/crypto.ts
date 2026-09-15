import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { OTP_DIGITS, OTP_MAX_EXCLUSIVE, OTP_MIN } from "@/lib/auth/login-otp/constants";

/**
 * Crypto-secure 6-digit OTP in 000000–999999.
 * Uses node:crypto.randomInt (CSPRNG).
 */
export function generateOtpDigits(): string {
  const n = randomInt(OTP_MIN, OTP_MAX_EXCLUSIVE);
  return String(n).padStart(OTP_DIGITS, "0");
}

export function isOtpDigitString(value: string): boolean {
  return new RegExp(`^\\d{${OTP_DIGITS}}$`).test(value);
}

export function normalizeOtpInput(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

export function hashOtp(code: string, challengeId: string, pepper: string): string {
  return createHmac("sha256", pepper).update(`${challengeId}:${code}`).digest("hex");
}

export function otpHashesEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length === 0 || ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
