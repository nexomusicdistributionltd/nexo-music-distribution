import { describe, expect, it } from "vitest";
import { canOfferWebsitePlayback, isTrackPlaybackEligible } from "./eligibility";
import { releaseCanonicalPath, artistCanonicalPath } from "./slugs";
import { buildDspOutboundLinks } from "./dsp-links";

describe("Nexo player eligibility", () => {
  it("requires publish + playback for release audio", () => {
    expect(
      canOfferWebsitePlayback({ website_published: true, website_playback_enabled: true })
    ).toBe(true);
    expect(
      canOfferWebsitePlayback({ website_published: true, website_playback_enabled: false })
    ).toBe(false);
  });

  it("honors track-level preview flag when present", () => {
    expect(
      isTrackPlaybackEligible({
        website_published: true,
        website_playback_enabled: true,
        website_preview_enabled: true,
      })
    ).toBe(true);
    expect(
      isTrackPlaybackEligible({
        website_published: true,
        website_playback_enabled: true,
        website_preview_enabled: false,
      })
    ).toBe(false);
    expect(
      isTrackPlaybackEligible({
        website_published: true,
        website_playback_enabled: true,
        website_preview_enabled: null,
      })
    ).toBe(true);
  });
});

describe("slug canonical helpers", () => {
  it("prefers /release and /artist paths", () => {
    expect(releaseCanonicalPath("my-album", "uuid")).toBe("/release/my-album");
    expect(releaseCanonicalPath(null, "uuid")).toBe("/release/uuid");
    expect(artistCanonicalPath("jane-doe")).toBe("/artist/jane-doe");
  });
});

describe("DSP outbound links", () => {
  it("labels outbound DSP URLs and ignores empty", () => {
    expect(buildDspOutboundLinks({})).toEqual([]);
    const links = buildDspOutboundLinks({
      website_embed_spotify_url: "https://open.spotify.com/album/abc",
      website_embed_apple_url: "javascript:alert(1)",
    });
    expect(links).toHaveLength(1);
    expect(links[0].label).toBe("Listen on Spotify");
  });
});

describe("homepage featured filters", () => {
  it("only website_published cards are eligible for listing helpers", async () => {
    const { isPublicMusicEligible } = await import("./eligibility");
    expect(isPublicMusicEligible({ website_published: true, website_featured: true })).toBe(
      true
    );
    expect(isPublicMusicEligible({ website_published: false, website_featured: true })).toBe(
      false
    );
  });
});
