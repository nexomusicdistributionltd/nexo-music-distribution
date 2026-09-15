import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NullEmailProvider } from "./providers/null-provider";
import { getEmailProvider, getEmailProviderStatus } from "./provider";

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

describe("NullEmailProvider", () => {
  it("returns unavailable — never accepted", async () => {
    const p = new NullEmailProvider("test");
    const r = await p.send({
      to: "a@b.com",
      subject: "x",
      html: "<p>y</p>",
    });
    expect(r.accepted).toBe(false);
    expect(r.unavailable).toBe(true);
    expect(r.provider).toBe("null");
  });
});

describe("getEmailProvider (Zoho SMTP only — no Resend)", () => {
  beforeEach(() => {
    snapshotEnv();
    clearEmailEnv();
  });
  afterEach(() => {
    restoreEnv();
  });

  it("defaults to null/unavailable when SMTP vars missing", async () => {
    const p = getEmailProvider();
    expect(p.name).toBe("null");
    const r = await p.send({ to: "a@b.com", subject: "s", html: "h" });
    expect(r.accepted).toBe(false);
    expect(r.unavailable).toBe(true);
    const status = getEmailProviderStatus();
    expect(status.configured).toBe(false);
    expect(status.name).toBe("null");
    expect(status.message.toLowerCase()).toMatch(/zoho smtp is not configured/);
    expect(status.message.toLowerCase()).toMatch(/queued or skipped/);
  });

  it("ignores EMAIL_PROVIDER=resend and RESEND_API_KEY", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_fake_should_not_matter";
    const p = getEmailProvider();
    expect(p.name).toBe("null");
    const r = await p.send({ to: "a@b.com", subject: "s", html: "h" });
    expect(r.accepted).toBe(false);
    expect(r.unavailable).toBe(true);
    expect(getEmailProviderStatus().configured).toBe(false);
    expect(p.name).not.toBe("resend");
  });

  it("selects zoho-smtp when SMTP_HOST + USER + PASSWORD are set", () => {
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_x";
    process.env.SMTP_HOST = "smtp.zoho.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "contact@nexomusicdistro.space";
    process.env.SMTP_PASSWORD = "app-password-placeholder";
    const p = getEmailProvider();
    expect(p.name).toBe("zoho-smtp");
    const status = getEmailProviderStatus();
    expect(status.configured).toBe(true);
    expect(status.name).toBe("zoho-smtp");
    expect(status.message.toLowerCase()).toMatch(/zoho/);
    expect(status.message.toLowerCase()).toMatch(/resend is not used/);
  });
});
