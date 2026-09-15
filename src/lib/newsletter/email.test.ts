import { describe, expect, it } from "vitest";
import {
  filterActiveSubscriberEmails,
  isUnsubscribeTokenShape,
  isValidNewsletterEmail,
  normalizeNewsletterEmail,
} from "./email";

describe("normalizeNewsletterEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeNewsletterEmail("  Alex@Nexo.COM ")).toBe("alex@nexo.com");
  });
  it("handles non-strings", () => {
    expect(normalizeNewsletterEmail(null)).toBe("");
    expect(normalizeNewsletterEmail(12)).toBe("");
  });
});

describe("isValidNewsletterEmail", () => {
  it("accepts simple emails", () => {
    expect(isValidNewsletterEmail("a@b.co")).toBe(true);
  });
  it("rejects invalid", () => {
    expect(isValidNewsletterEmail("")).toBe(false);
    expect(isValidNewsletterEmail("not-an-email")).toBe(false);
    expect(isValidNewsletterEmail("a@b")).toBe(false);
  });
});

describe("duplicate / active filtering", () => {
  it("excludes unsubscribed and dedupes", () => {
    const emails = filterActiveSubscriberEmails([
      { email: "A@B.COM", status: "active" },
      { email: "a@b.com", status: "active" },
      { email: "gone@x.com", status: "unsubscribed" },
      { email: "ok@x.com", status: "active" },
    ]);
    expect(emails).toEqual(["a@b.com", "ok@x.com"]);
  });
});

describe("unsubscribe token", () => {
  it("accepts hex tokens", () => {
    expect(isUnsubscribeTokenShape("aabbccddeeff00112233445566778899")).toBe(true);
  });
  it("rejects short or non-hex", () => {
    expect(isUnsubscribeTokenShape("short")).toBe(false);
    expect(isUnsubscribeTokenShape("zzzzzzzzzzzzzzzzzzzz")).toBe(false);
    expect(isUnsubscribeTokenShape(null)).toBe(false);
  });
});
