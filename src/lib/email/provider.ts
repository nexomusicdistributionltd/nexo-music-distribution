import type { EmailProvider, EmailSendResult } from "./types";
import { NullEmailProvider } from "./providers/null-provider";
import {
  DEFAULT_EMAIL_FROM,
  isZohoSmtpConfigured,
  sendViaZohoSmtp,
} from "./zoho-smtp";

export type { EmailProvider } from "./types";

const PROVIDER_NAME = "zoho-smtp";

/**
 * Admin + outbox send adapter.
 * Reuses src/lib/email/zoho-smtp.ts — never creates another transporter.
 * RESEND_API_KEY / EMAIL_PROVIDER=resend are ignored.
 */
function createZohoSmtpAdapter(): EmailProvider {
  return {
    name: PROVIDER_NAME,
    async send(input: {
      to: string;
      subject: string;
      html: string;
      from?: string;
      idempotencyKey?: string;
    }): Promise<EmailSendResult> {
      void input.idempotencyKey;
      const result = await sendViaZohoSmtp({
        to: input.to,
        subject: input.subject,
        html: input.html,
        from: input.from,
      });
      if (!result.ok) {
        return {
          accepted: false,
          provider: PROVIDER_NAME,
          error: result.error,
        };
      }
      return {
        accepted: true,
        provider: PROVIDER_NAME,
        messageId: result.messageId,
      };
    },
  };
}

export function getEmailProvider(): EmailProvider {
  if (!isZohoSmtpConfigured()) {
    return new NullEmailProvider("Zoho SMTP not configured");
  }
  return createZohoSmtpAdapter();
}

export function defaultFromAddress(): string {
  return (process.env.EMAIL_FROM ?? "").trim() || DEFAULT_EMAIL_FROM;
}

export type EmailProviderStatus = {
  configured: boolean;
  mode: string;
  name: string;
  message: string;
};

/** Truthful admin-facing provider state. Never reports success when unconfigured. Never prefers Resend. */
export function getEmailProviderStatus(): EmailProviderStatus {
  if (!isZohoSmtpConfigured()) {
    return {
      configured: false,
      mode: "none",
      name: "null",
      message:
        "Zoho SMTP is not configured. Sends stay queued or skipped. Nothing was marked sent. RESEND_API_KEY is ignored.",
    };
  }
  return {
    configured: true,
    mode: "smtp",
    name: PROVIDER_NAME,
    message:
      "Zoho Mail SMTP (smtp.zoho.com) is configured. SENT is recorded only after SMTP accepts with a message id. Resend is not used.",
  };
}
