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
