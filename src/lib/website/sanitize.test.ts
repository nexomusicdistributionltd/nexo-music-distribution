import { describe, expect, it } from "vitest";
import { sanitizeCmsHtml, isSafeHttpUrl, slugify } from "./sanitize";

describe("sanitizeCmsHtml", () => {
  it("strips script tags", () => {
    const out = sanitizeCmsHtml('<p>Hi</p><script>alert(1)</script>');
    expect(out).toContain("<p>Hi</p>");
    expect(out.toLowerCase()).not.toContain("script");
  });

  it("keeps basic formatting and links", () => {
    const out = sanitizeCmsHtml('<p><strong>Bold</strong> <a href="https://example.com">x</a></p>');
    expect(out).toContain("<strong>");
    expect(out).toContain('href="https://example.com"');
  });

  it("returns empty for nullish", () => {
    expect(sanitizeCmsHtml(null)).toBe("");
    expect(sanitizeCmsHtml(undefined)).toBe("");
  });
});

describe("isSafeHttpUrl", () => {
  it("allows https", () => {
    expect(isSafeHttpUrl("https://open.spotify.com/track/1")).toBe(true);
  });
  it("blocks javascript", () => {
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("slugify", () => {
  it("normalizes", () => {
    expect(slugify(" Hello World! ")).toBe("hello-world");
  });
});
