import { describe, expect, it } from "vitest";
import { escapeHtml, sanitizeEmailVars } from "./sanitize";

describe("escapeHtml", () => {
  it("escapes user-controlled HTML", () => {
    expect(escapeHtml(`<script>alert("x")</script>&'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;"
    );
  });
});

describe("sanitizeEmailVars", () => {
  it("stringifies and escapes values", () => {
    const out = sanitizeEmailVars({
      RELEASE_TITLE: "<b>Hit</b>",
      COUNT: 3,
      EMPTY: null,
    });
    expect(out.RELEASE_TITLE).toBe("&lt;b&gt;Hit&lt;/b&gt;");
    expect(out.COUNT).toBe("3");
    expect(out.EMPTY).toBe("");
  });
});
