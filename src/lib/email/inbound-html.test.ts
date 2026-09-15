import { describe, expect, it } from "vitest";
import { htmlToPlainText, sanitizeInboundHtml } from "./inbound-html";

describe("sanitizeInboundHtml", () => {
  it("strips scripts, forms, and event handlers", () => {
    const dirty =
      '<p>Hi</p><script>alert(1)</script><img src=x onerror="alert(2)"><a href="javascript:alert(3)">x</a>';
    const clean = sanitizeInboundHtml(dirty);
    expect(clean).toContain("Hi");
    expect(clean.toLowerCase()).not.toContain("script");
    expect(clean.toLowerCase()).not.toContain("onerror");
    expect(clean.toLowerCase()).not.toContain("javascript:");
  });
});

describe("htmlToPlainText", () => {
  it("converts simple markup", () => {
    expect(htmlToPlainText("<p>Hello <b>Ada</b></p>")).toContain("Hello Ada");
  });
});
