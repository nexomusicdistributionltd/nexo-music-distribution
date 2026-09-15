import { describe, expect, it } from "vitest";
import {
  isPublicMusicEligible,
  canOfferWebsitePlayback,
  publicStatusLabel,
  hasOfficialEmbed,
  hasDspOutboundLinks,
} from "./eligibility";

describe("public music eligibility", () => {
  it("requires website_published", () => {
    expect(isPublicMusicEligible({ website_published: false, status: "live" })).toBe(false);
    expect(isPublicMusicEligible({ website_published: true, status: "draft" })).toBe(true);
  });

  it("playback requires publish + flag", () => {
    expect(
      canOfferWebsitePlayback({ website_published: true, website_playback_enabled: false })
    ).toBe(false);
    expect(
      canOfferWebsitePlayback({ website_published: true, website_playback_enabled: true })
    ).toBe(true);
  });

  it("never invents LIVE label", () => {
    expect(publicStatusLabel("draft")).toBeNull();
    expect(publicStatusLabel("scheduled")).toBeNull();
    expect(publicStatusLabel("live")).toBe("Live on DSPs");
    expect(publicStatusLabel("delivered")).toBe("Delivered");
  });

  it("detects DSP outbound link fields (not primary embeds)", () => {
    expect(hasOfficialEmbed({})).toBe(false);
    expect(hasDspOutboundLinks({ website_embed_spotify_url: "https://open.spotify.com/x" })).toBe(
      true
    );
  });
});
