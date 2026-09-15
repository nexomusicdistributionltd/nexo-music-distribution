import { describe, expect, it } from "vitest";
import {
  HOMEPAGE_IMAGE_PRESETS,
  resolveHomepageImage,
  resolveHomepageImageMap,
  isLocalHomepageImage,
} from "./homepage-images";

describe("resolveHomepageImage", () => {
  it("falls back to vinyl preset when url is null/empty", () => {
    expect(resolveHomepageImage(null, "singer")).toBe(HOMEPAGE_IMAGE_PRESETS.singer);
    expect(resolveHomepageImage(null, "vinyl")).toBe(HOMEPAGE_IMAGE_PRESETS.vinyl);
    expect(resolveHomepageImage("", "console")).toBe(HOMEPAGE_IMAGE_PRESETS.console);
    expect(resolveHomepageImage("   ", "score")).toBe(HOMEPAGE_IMAGE_PRESETS.score);
  });

  it("rejects placeholder paths", () => {
    expect(resolveHomepageImage("/images/placeholder.jpg", "waveform")).toBe(
      HOMEPAGE_IMAGE_PRESETS.waveform
    );
    expect(
      resolveHomepageImage("https://cdn.example.com/placeholder.png", "studio")
    ).toBe(HOMEPAGE_IMAGE_PRESETS.studio);
  });

  it("accepts local /images assets", () => {
    expect(resolveHomepageImage("/images/vinyl.jpg", "console")).toBe("/images/vinyl.jpg");
  });

  it("accepts https CMS urls", () => {
    const url = "https://xyz.supabase.co/storage/v1/object/public/cms-media/hero.jpg";
    expect(resolveHomepageImage(url, "vinyl")).toBe(url);
  });

  it("rejects http and non-url junk", () => {
    expect(resolveHomepageImage("http://insecure.example/a.jpg", "vinyl")).toBe(
      HOMEPAGE_IMAGE_PRESETS.vinyl
    );
    expect(resolveHomepageImage("javascript:alert(1)", "vinyl")).toBe(
      HOMEPAGE_IMAGE_PRESETS.vinyl
    );
    expect(resolveHomepageImage("not a url", "studio")).toBe(HOMEPAGE_IMAGE_PRESETS.studio);
  });

  it("resolveHomepageImageMap fills all section keys", () => {
    const map = resolveHomepageImageMap({
      hero_image_url: "https://cdn.example.com/hero.jpg",
      artists_image_url: "",
    });
    expect(map.hero_image_url).toBe("https://cdn.example.com/hero.jpg");
    expect(map.artists_image_url).toBe(HOMEPAGE_IMAGE_PRESETS.live);
    expect(map.publishing_image_url).toBe(HOMEPAGE_IMAGE_PRESETS.headphones);
    expect(map.cta_image_url).toBe(HOMEPAGE_IMAGE_PRESETS.live);
    expect(isLocalHomepageImage(map.royalties_image_url)).toBe(true);
  });
});
