import type { EmailProvider, EmailSendResult } from "../types";

/**
 * SMTP stub: only activates when SMTP_* env is present.
 * Does not pretend success without a real transport implementation.
 * Returns unavailable until a production SMTP transport is wired.
 */
export function createSmtpStubProvider(_cfg: {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
}): EmailProvider {
  return {
    name: "smtp",
    async send(): Promise<EmailSendResult> {
      return {
        accepted: false,
        unavailable: true,
        provider: "smtp",
        error:
          "SMTP env present but transport not wired — refusing fake success",
      };
    },
  };
}
