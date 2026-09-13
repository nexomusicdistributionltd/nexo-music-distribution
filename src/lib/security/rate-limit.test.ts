import { describe, expect, it, beforeEach } from "vitest";
import {
  __resetRateLimitStoreForTests,
  checkRateLimit,
  clientIpFromRequest,
  RATE_LIMITS,
} from "./rate-limit";
import { publicErrorMessage } from "@/lib/http/safe-error";
import { getSiteUrl, DEFAULT_SITE_URL } from "@/lib/site-url";

describe("rate limit", () => {
  beforeEach(() => {
    __resetRateLimitStoreForTests();
  });

  it("allows under limit and blocks over limit (fail closed)", () => {
    const key = "test:contact:1";
    for (let i = 0; i < RATE_LIMITS.contact.limit; i++) {
      const r = checkRateLimit({ key, ...RATE_LIMITS.contact });
      expect(r.ok).toBe(true);
    }
    const blocked = checkRateLimit({ key, ...RATE_LIMITS.contact });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("isolates keys", () => {
    expect(checkRateLimit({ key: "a", limit: 1, windowMs: 60_000 }).ok).toBe(true);
    expect(checkRateLimit({ key: "b", limit: 1, windowMs: 60_000 }).ok).toBe(true);
    expect(checkRateLimit({ key: "a", limit: 1, windowMs: 60_000 }).ok).toBe(false);
  });

  it("parses client IP from x-forwarded-for", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(clientIpFromRequest(req)).toBe("1.2.3.4");
  });
});

describe("publicErrorMessage", () => {
  it("strips SQL / secrets", () => {
    expect(publicErrorMessage("password=secret")).toBe("Request failed.");
    expect(publicErrorMessage("permission denied for table")).toBe(
      "Request could not be completed."
    );
    expect(publicErrorMessage("Invalid fields.")).toBe("Invalid fields.");
  });
});

describe("getSiteUrl", () => {
  it("defaults to production canonical", () => {
    const prev = process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(getSiteUrl()).toBe(DEFAULT_SITE_URL);
    process.env.NEXT_PUBLIC_SITE_URL = prev;
  });
});
