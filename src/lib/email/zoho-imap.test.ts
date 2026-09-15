import { afterEach, describe, expect, it } from "vitest";
import { isZohoImapConfigured, resolveZohoImapConfig } from "./zoho-imap";
import { isZohoSmtpConfigured, resolveZohoMailAuth } from "./zoho-smtp";
import { parsedMailToInbox } from "./zoho-imap";
import type { ParsedMail } from "mailparser";

const ENV_KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_PASS",
  "ZOHO_SMTP_APP_PASSWORD",
  "IMAP_HOST",
  "IMAP_PORT",
  "RESEND_API_KEY",
  "EMAIL_PROVIDER",
] as const;

const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function snapshot() {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
}
function restore() {
  for (const k of ENV_KEYS) {
    const v = saved[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}
function clear() {
  for (const k of ENV_KEYS) delete process.env[k];
}

snapshot();
afterEach(restore);

describe("Zoho IMAP config shares SMTP mailbox auth (no Resend)", () => {
  it("is off when SMTP mailbox creds missing even if RESEND is set", () => {
    clear();
    process.env.RESEND_API_KEY = "re_x";
    process.env.EMAIL_PROVIDER = "resend";
    expect(isZohoSmtpConfigured()).toBe(false);
    expect(isZohoImapConfigured()).toBe(false);
    expect(resolveZohoMailAuth()).toBe(null);
  });

  it("defaults to imap.zoho.com:993 with the same user/password as SMTP", () => {
    clear();
    process.env.SMTP_HOST = "smtp.zoho.com";
    process.env.SMTP_USER = "contact@nexomusicdistro.space";
    process.env.SMTP_PASSWORD = "app-password-placeholder";
    expect(isZohoImapConfigured()).toBe(true);
    const cfg = resolveZohoImapConfig();
    expect(cfg?.host).toBe("imap.zoho.com");
    expect(cfg?.port).toBe(993);
    expect(cfg?.secure).toBe(true);
    expect(cfg?.user).toBe("contact@nexomusicdistro.space");
    expect(cfg?.password).toBe("app-password-placeholder");
  });
});

describe("parsedMailToInbox", () => {
  it("sanitizes HTML and builds a thread key without using outbound events", () => {
    const parsed = {
      messageId: "<id-2@nexo>",
      inReplyTo: "<id-1@nexo>",
      references: "<id-1@nexo>",
      subject: "Hello",
      date: new Date("2026-09-15T00:00:00Z"),
      html: '<p>Hi</p><script>alert(1)</script>',
      text: "Hi",
      from: { value: [{ address: "a@b.com", name: "A" }] },
      to: { value: [{ address: "contact@nexomusicdistro.space" }] },
      attachments: [],
    } as unknown as ParsedMail;
    const row = parsedMailToInbox(parsed, { folder: "INBOX", uid: 9, seen: false });
    expect(row.threadKey).toBe("id-1@nexo");
    expect(row.fromEmail).toBe("a@b.com");
    expect(row.htmlBodySanitized.toLowerCase()).not.toContain("script");
    expect(row.seen).toBe(false);
  });
});
