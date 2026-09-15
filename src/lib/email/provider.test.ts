import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { NullEmailProvider } from "./providers/null-provider";
import { getEmailProvider, getEmailProviderStatus } from "./provider";

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

describe("getEmailProvider", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });
  beforeEach(() => {
    process.env = { ...env };
  });

  it("defaults to null/unavailable when EMAIL_PROVIDER=none", async () => {
    process.env.EMAIL_PROVIDER = "none";
    delete process.env.RESEND_API_KEY;
    const p = getEmailProvider();
    const r = await p.send({ to: "a@b.com", subject: "s", html: "h" });
    expect(r.accepted).toBe(false);
    expect(r.unavailable).toBe(true);
    const status = getEmailProviderStatus();
    expect(status.configured).toBe(false);
    expect(status.message.toLowerCase()).toMatch(/queued or skipped|not fabricated|unset or none/);
  });

  it("resend without key → unavailable (no fake success)", async () => {
    process.env.EMAIL_PROVIDER = "resend";
    delete process.env.RESEND_API_KEY;
    const p = getEmailProvider();
    const r = await p.send({ to: "a@b.com", subject: "s", html: "h" });
    expect(r.accepted).toBe(false);
    expect(r.unavailable).toBe(true);
  });
});
