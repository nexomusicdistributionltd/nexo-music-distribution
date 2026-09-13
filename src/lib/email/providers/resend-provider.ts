import type { EmailProvider, EmailSendResult } from "../types";

/** Activates only when RESEND_API_KEY is present. No fake success. */
export function createResendProvider(apiKey: string): EmailProvider {
  return {
    name: "resend",
    async send(input): Promise<EmailSendResult> {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: input.from,
            to: [input.to],
            subject: input.subject,
            html: input.html,
            headers: input.idempotencyKey
              ? { "Idempotency-Key": input.idempotencyKey }
              : undefined,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          id?: string;
          message?: string;
          error?: { message?: string };
        };
        if (!res.ok) {
          return {
            accepted: false,
            provider: "resend",
            error:
              body.error?.message ||
              body.message ||
              `Resend HTTP ${res.status}`,
          };
        }
        if (!body.id) {
          return {
            accepted: false,
            provider: "resend",
            error: "Resend response missing message id",
          };
        }
        return { accepted: true, messageId: body.id, provider: "resend" };
      } catch (e) {
        return {
          accepted: false,
          provider: "resend",
          error: e instanceof Error ? e.message : "Resend request failed",
        };
      }
    },
  };
}
