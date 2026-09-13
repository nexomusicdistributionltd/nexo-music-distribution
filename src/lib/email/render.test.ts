import { describe, expect, it } from "vitest";
import { substitutePlaceholders } from "./render";
import { assertApprovedTemplateKey } from "./catalog";

describe("substitutePlaceholders", () => {
  it("escapes interpolated values", () => {
    const html = "<p>Hi {{FIRST_NAME}} — {{RELEASE_TITLE}}</p>";
    const out = substitutePlaceholders(html, {
      FIRST_NAME: "A<script>",
      RELEASE_TITLE: "Song & Dance",
    });
    expect(out).toContain("A&lt;script&gt;");
    expect(out).toContain("Song &amp; Dance");
    expect(out).not.toContain("<script>");
  });

  it("rejects unauthorized template keys", () => {
    expect(() => assertApprovedTemplateKey("EVIL_TEMPLATE")).toThrow();
  });
});
