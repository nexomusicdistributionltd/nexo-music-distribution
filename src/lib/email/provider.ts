import type { EmailProvider } from "./types";
import { NullEmailProvider } from "./providers/null-provider";
import { createResendProvider } from "./providers/resend-provider";
import { createSmtpStubProvider } from "./providers/smtp-stub";

export type { EmailProvider } from "./types";

/**
 * Select provider from env. Never fake success when unconfigured.
 * EMAIL_PROVIDER=none|resend|smtp
 */
export function getEmailProvider(): EmailProvider {
  const mode = (process.env.EMAIL_PROVIDER ?? "none").toLowerCase().trim();

  if (mode === "resend") {
    const key = process.env.RESEND_API_KEY?.trim();
    if (!key) return new NullEmailProvider("RESEND_API_KEY missing");
    return createResendProvider(key);
  }

  if (mode === "smtp") {
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    if (!host || !user || !pass) {
      return new NullEmailProvider("SMTP_* incomplete");
    }
    return createSmtpStubProvider({
      host,
      port: Number(process.env.SMTP_PORT ?? "587"),
      user,
      pass,
      secure: process.env.SMTP_SECURE === "true",
    });
  }

  return new NullEmailProvider("EMAIL_PROVIDER=none");
}

export function defaultFromAddress(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    "Nexo Music Distribution LTD <contact@nexomusicdistro.space>"
  );
}

export type EmailProviderStatus = {
  configured: boolean;
  mode: string;
  name: string;
  message: string;
};

/** Truthful admin-facing provider state. Never reports success when unconfigured. */
export function getEmailProviderStatus(): EmailProviderStatus {
  const mode = (process.env.EMAIL_PROVIDER ?? "none").toLowerCase().trim() || "none";
  if (mode === "resend") {
    if (!process.env.RESEND_API_KEY?.trim()) {
      return {
        configured: false,
        mode,
        name: "null",
        message:
          "EMAIL_PROVIDER=resend but RESEND_API_KEY is missing. Sends stay skipped — nothing is marked sent.",
      };
    }
    return {
      configured: true,
      mode,
      name: "resend",
      message: "Resend is configured. SENT is recorded only after Resend accepts the message.",
    };
  }
  if (mode === "smtp") {
    const host = process.env.SMTP_HOST?.trim();
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();
    if (!host || !user || !pass) {
      return {
        configured: false,
        mode,
        name: "null",
        message:
          "EMAIL_PROVIDER=smtp but SMTP_* is incomplete. Sends stay skipped — nothing is marked sent.",
      };
    }
    return {
      configured: true,
      mode,
      name: "smtp-stub",
      message: "SMTP transport is configured. SENT is recorded only after the server accepts the message.",
    };
  }
  return {
    configured: false,
    mode: "none",
    name: "null",
    message:
      "EMAIL_PROVIDER is unset or none. Events stay queued or skipped. Delivery is not fabricated.",
  };
}
