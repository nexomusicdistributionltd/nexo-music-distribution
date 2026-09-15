import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { composeFromShell, htmlContainsAlbumArtwork } from "./compose";
import { substitutePlaceholders } from "./render";
import { listSeedTemplateSpecs } from "./seed-spec";

describe("htmlContainsAlbumArtwork", () => {
  it("flags cover images, not the words in copy", () => {
    expect(htmlContainsAlbumArtwork('<p>No album artwork in this send.</p>')).toBe(false);
    expect(
      htmlContainsAlbumArtwork('<img alt="Album art" src="https://cdn.example/cover.jpg" />')
    ).toBe(true);
  });
});

describe("composeFromShell", () => {
  it("injects trusted body HTML without escaping tags", () => {
    const shell = "<html>{{PREHEADER}}|{{BODY}}</html>";
    const out = composeFromShell(shell, {
      preheader: "Hi <x>",
      bodyHtml: "<p>Hello</p>",
      title: "T",
    });
    expect(out).toContain("<p>Hello</p>");
    expect(out).toContain("Hi &lt;x&gt;");
    expect(out).not.toContain("{{BODY}}");
  });
});

describe("newsletter HTML", () => {
  it("seeds NEWSLETTER and NEW_MUSIC_FRIDAY without album artwork", () => {
    const specs = listSeedTemplateSpecs();
    const keys = specs.map((s) => s.key);
    expect(keys).toContain("NEWSLETTER");
    expect(keys).toContain("NEW_MUSIC_FRIDAY");
    expect(keys).toContain("RELEASE_SUBMITTED");
    expect(keys.some((k) => k.startsWith("AUTH_"))).toBe(false);

    for (const key of ["NEWSLETTER", "NEW_MUSIC_FRIDAY"] as const) {
      const spec = specs.find((s) => s.key === key);
      expect(spec?.category).toBe("newsletter");
      const html = fs.readFileSync(path.join(process.cwd(), spec!.filePath), "utf8");
      expect(htmlContainsAlbumArtwork(html)).toBe(false);
      expect(html).toContain("#050505");
      expect(html).toContain("#0a0a0a");
      expect(html).toContain("Nexo Music Distribution LTD");
      expect(html).toContain(
        "https://d2ol7oe51mr4n9.cloudfront.net/user_3J50bnYm6p1zfDNZ4mvIkqNfXgQ/5d2343c0-6c83-4277-855d-696ffca77790.png"
      );
      expect(html).toContain("nexo-icon-light-v2.png");
      expect(html).not.toContain("{{BODY}}");
    }
  });

  it("allows logo images but not cover/artwork alts", () => {
    const html = fs.readFileSync(
      path.join(process.cwd(), "emails/templates/NEW_MUSIC_FRIDAY.html"),
      "utf8"
    );
    expect(html).toMatch(/<img /);
    expect(htmlContainsAlbumArtwork(html)).toBe(false);
    expect(html.toLowerCase()).not.toMatch(/<(img|image)[^>]*(cover|artwork)/);
    expect(substitutePlaceholders("Hi {{FIRST_NAME}}", { FIRST_NAME: "Ada" })).toBe(
      "Hi Ada"
    );
  });
});
