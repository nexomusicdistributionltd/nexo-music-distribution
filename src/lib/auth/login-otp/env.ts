import { getServiceRoleKey, getServiceRoleKeyStatus } from "@/lib/supabase/admin";
import { isZohoSmtpConfigured } from "@/lib/email/zoho-smtp";

/** Dedicated HMAC pepper. Prefer this over hashing with the service role key. */
export const OTP_PEPPER_ENV_NAME = "NEXO_OTP_PEPPER";

export const OTP_UNAVAILABLE_USER_MESSAGE =
  "Verification is temporarily unavailable. Please try again in a moment.";

export const OTP_SEND_FAILED_USER_MESSAGE =
  "We could not send a verification code. Try again in a moment.";

export function getOtpPepper(env: NodeJS.ProcessEnv = process.env): string {
  const dedicated = (env[OTP_PEPPER_ENV_NAME] ?? "").trim();
  if (dedicated) return dedicated;
  return getServiceRoleKey(env);
}

export function isOtpPepperConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return getOtpPepper(env).length > 0;
}

export type LoginOtpHealthSnapshot = {
  serviceRole: "present" | "absent" | "invalid_anon";
  smtp: "present" | "absent";
  pepper: "present" | "absent";
  sendReady: boolean;
  verifyReady: boolean;
};

export function loginOtpHealthSnapshot(
  env: NodeJS.ProcessEnv = process.env,
  smtpConfigured: boolean = isZohoSmtpConfigured()
): LoginOtpHealthSnapshot {
  const serviceRole = getServiceRoleKeyStatus(env);
  const smtp = smtpConfigured ? "present" : "absent";
  const pepper = isOtpPepperConfigured(env) ? "present" : "absent";
  const verifyReady = serviceRole === "present" && pepper === "present";
  const sendReady = verifyReady && smtp === "present";
  return { serviceRole, smtp, pepper, sendReady, verifyReady };
}

export function challengeWriteLooksLikeMissingTable(error: {
  message?: string;
  code?: string;
} | null | undefined): boolean {
  const code = (error?.code ?? "").trim();
  const message = (error?.message ?? "").toLowerCase();
  if (code === "42P01" || code === "PGRST205") return true;
  return /does not exist|schema cache|relation .*login_otp/i.test(message);
}
