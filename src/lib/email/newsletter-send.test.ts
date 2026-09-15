import { afterEach, describe, expect, it } from "vitest";
import {
  buildNewsletterHtml,
  isEmailProviderConfigured,
  resolveEmailProviderName,
} from "./newsletter-send";
import { isZohoSmtpConfigured, resolveZohoSmtpConfig } from "./zoho-smtp";

const ENV_KEYS = [
  "EMAIL_PROVIDER",
  "EMAIL_FROM",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "SMTP_PASS",
  "ZOHO_SMTP_APP_PASSWORD",
  "RESEND_API_KEY",
] as const;

const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function snapshotEnv() {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
}

function restoreEnv() {
  for (const k of ENV_KEYS) {
    const v = saved[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function clearEmailEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

snapshotEnv();

afterEach(() => {
  restoreEnv();
});

describe("newsletter email provider (Zoho SMTP only — no Resend)", () => {
  it("is not configured when SMTP vars missing (RESEND alone does not count)", () => {
    clearEmailEnv();
    process.env.RESEND_API_KEY = "re_fake_should_not_matter";
    process.env.EMAIL_PROVIDER = "resend";
    expect(isZohoSmtpConfigured()).toBe(false);
    expect(isEmailProviderConfigured()).toBe(false);
    expect(resolveEmailProviderName()).toBe(null);
  });

  it("detects Zoho SMTP via SMTP_HOST + USER + PASSWORD", () => {
    clearEmailEnv();
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = "smtp.zoho.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "contact@nexomusicdistro.space";
    process.env.SMTP_PASSWORD = "app-password-placeholder";
    expect(isEmailProviderConfigured()).toBe(true);
    expect(resolveEmailProviderName()).toBe("zoho-smtp");
    const cfg = resolveZohoSmtpConfig();
    expect(cfg?.host).toBe("smtp.zoho.com");
    expect(cfg?.port).toBe(465);
    expect(cfg?.secure).toBe(true);
  });

  it("defaults host to smtp.zoho.com when ZOHO_SMTP_APP_PASSWORD set and SMTP_HOST empty", () => {
    clearEmailEnv();
    process.env.SMTP_USER = "contact@nexomusicdistro.space";
    process.env.ZOHO_SMTP_APP_PASSWORD = "app-password-placeholder";
    expect(isZohoSmtpConfigured()).toBe(true);
    const cfg = resolveZohoSmtpConfig();
    expect(cfg?.host).toBe("smtp.zoho.com");
    expect(cfg?.port).toBe(465);
    expect(cfg?.secure).toBe(true);
    expect(resolveEmailProviderName()).toBe("zoho-smtp");
  });

  it("accepts SMTP_PASS as password alternate", () => {
    clearEmailEnv();
    process.env.SMTP_HOST = "smtp.zoho.com";
    process.env.SMTP_USER = "contact@nexomusicdistro.space";
    process.env.SMTP_PASS = "alt-pass";
    expect(isZohoSmtpConfigured()).toBe(true);
  });

  it("ignores RESEND_API_KEY / EMAIL_PROVIDER=resend when Zoho SMTP is configured", () => {
    clearEmailEnv();
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_x";
    process.env.SMTP_HOST = "smtp.zoho.com";
    process.env.SMTP_USER = "contact@nexomusicdistro.space";
    process.env.SMTP_PASSWORD = "x";
    expect(isEmailProviderConfigured()).toBe(true);
    expect(resolveEmailProviderName()).toBe("zoho-smtp");
  });
});

describe("buildNewsletterHtml", () => {
  it("includes unsubscribe link and dark branded shell", () => {
    const html = buildNewsletterHtml({
      subject: "Hello <Nexo>",
      bodyHtml: "<p>Body</p>",
      unsubscribeUrl:
        "https://nexomusicdistribution.com/newsletter/unsubscribe?token=abc",
    });
    expect(html).toContain("Unsubscribe");
    expect(html).toContain(
      "https://nexomusicdistribution.com/newsletter/unsubscribe?token=abc",
    );
    expect(html).toContain("#0a0a0a");
    expect(html).toContain("Nexo Music Distribution");
    expect(html).toContain("Hello &lt;Nexo&gt;");
    expect(html).not.toMatch(/resend/i);
  });
});
