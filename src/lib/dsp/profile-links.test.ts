import { describe, expect, it } from "vitest";
import {
  detectDspFromUrl,
  enabledDspTargets,
  parseOpenGraph,
  validateDspProfileUrl,
} from "./profile-links";

describe("DSP profile link validation", () => {
  it("accepts https profile URLs for known DSPs and rejects junk", () => {
    expect(validateDspProfileUrl("spotify", "https://open.spotify.com/artist/abc").ok).toBe(true);
    expect(validateDspProfileUrl("applemusic", "https://music.apple.com/us/artist/x/1").ok).toBe(
      true
    );
    expect(validateDspProfileUrl("audiomack", "https://audiomack.com/artist/x").ok).toBe(true);
    expect(validateDspProfileUrl("spotify", "http://open.spotify.com/artist/abc").ok).toBe(false);
    expect(validateDspProfileUrl("spotify", "javascript:alert(1)").ok).toBe(false);
    expect(validateDspProfileUrl("spotify", "https://evil.example/spotify").ok).toBe(false);
    expect(validateDspProfileUrl("spotify", "").ok).toBe(true);
    expect(detectDspFromUrl("https://audiomack.com/nexo")).toBe("audiomack");
  });

  it("enabled targeting only includes toggled URLs", () => {
    const links = enabledDspTargets([
      {
        dsp_key: "spotify",
        url: "https://open.spotify.com/artist/a",
        enabled: true,
        preview_name: "A",
        preview_image_url: null,
        preview_canonical_url: null,
      },
      {
        dsp_key: "applemusic",
        url: "https://music.apple.com/us/artist/b/1",
        enabled: false,
        preview_name: null,
        preview_image_url: null,
        preview_canonical_url: null,
      },
    ]);
    expect(links.map((l) => l.dsp_key)).toEqual(["spotify"]);
  });

  it("parses open-graph tags best-effort", () => {
    const html = `<html><head>
      <meta property="og:title" content="Nexo Artist" />
      <meta property="og:image" content="https://cdn.example/pic.jpg" />
      <meta property="og:url" content="https://open.spotify.com/artist/abc" />
    </head></html>`;
    const og = parseOpenGraph(html);
    expect(og.name).toBe("Nexo Artist");
    expect(og.image).toBe("https://cdn.example/pic.jpg");
    expect(og.canonicalUrl).toContain("spotify.com");
  });
});
