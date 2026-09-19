import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SITE_URL,
  authAppOrigin,
  authEmailRedirectUrl,
  getSiteUrl,
  isForbiddenAuthHost,
  resolveSiteUrl,
} from "./site-url";

describe("site URL / auth redirects", () => {
  const prevSite = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (prevSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = prevSite;
  });

  it("defaults to the official production domain", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(getSiteUrl()).toBe(DEFAULT_SITE_URL);
    expect(DEFAULT_SITE_URL).toBe("https://nexomusicdistribution.com");
  });

  it("treats localhost and Zoho mailbox host as forbidden auth origins", () => {
    expect(isForbiddenAuthHost("localhost")).toBe(true);
    expect(isForbiddenAuthHost("127.0.0.1")).toBe(true);
    expect(isForbiddenAuthHost("nexomusicdistro.space")).toBe(true);
    expect(isForbiddenAuthHost("mail.nexomusicdistro.space")).toBe(true);
    expect(isForbiddenAuthHost("nexomusicdistribution.com")).toBe(false);
  });

  it("never uses the Zoho mailbox domain as a site URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://nexomusicdistro.space";
    expect(getSiteUrl()).toBe(DEFAULT_SITE_URL);
  });

  it("builds auth email redirects on the official domain only", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(authEmailRedirectUrl("/auth/confirm")).toBe(
      "https://nexomusicdistribution.com/auth/confirm"
    );
    expect(authEmailRedirectUrl("/reset-password")).toBe(
      "https://nexomusicdistribution.com/reset-password"
    );
    expect(authEmailRedirectUrl("/auth/callback")).toBe(
      "https://nexomusicdistribution.com/auth/callback"
    );
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    expect(authEmailRedirectUrl("/reset-password")).toBe(
      "https://nexomusicdistribution.com/reset-password"
    );
  });

  it("throws in production when NEXT_PUBLIC_SITE_URL is localhost instead of emitting it", () => {
    expect(() => resolveSiteUrl("http://localhost:3000", "production")).toThrow(
      /forbidden host: localhost/i
    );
    expect(() => resolveSiteUrl("http://127.0.0.1:3000", "production")).toThrow(
      /forbidden host/i
    );
    expect(resolveSiteUrl("http://localhost:3000", "development")).toBe("http://localhost:3000");
    expect(resolveSiteUrl("", "production")).toBe(DEFAULT_SITE_URL);
  });

  it("rewrites callback origin away from localhost and Zoho mailbox", () => {
    expect(authAppOrigin("http://localhost:3000")).toBe(DEFAULT_SITE_URL);
    expect(authAppOrigin("https://nexomusicdistro.space")).toBe(DEFAULT_SITE_URL);
    expect(authAppOrigin("https://nexomusicdistribution.com")).toBe(DEFAULT_SITE_URL);
  });
});
