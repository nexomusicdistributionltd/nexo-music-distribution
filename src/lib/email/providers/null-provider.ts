import type { EmailProvider, EmailSendResult } from "../types";

/** Truthful unavailable provider — never reports accepted/sent. */
export class NullEmailProvider implements EmailProvider {
  readonly name = "null";
  constructor(private readonly reason = "Email provider not configured") {}

  async send(): Promise<EmailSendResult> {
    return {
      accepted: false,
      unavailable: true,
      provider: this.name,
      error: this.reason,
    };
  }
}
