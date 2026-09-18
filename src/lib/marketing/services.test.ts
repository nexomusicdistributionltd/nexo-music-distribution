import { describe, expect, it } from "vitest";
import { MARKETING_SERVICE_SPECS, marketingServiceSpec } from "./services";

describe("marketing service registry", () => {
  it("covers every request-based marketing destination", () => {
    const kinds = MARKETING_SERVICE_SPECS.map((service) => service.kind);
    expect(kinds).toEqual(
      expect.arrayContaining([
        "dsp_pitching",
        "campaign",
        "priority_pitch",
        "spotify_discovery_mode",
        "promotional_assets",
        "fan_blast",
        "award_monitoring",
        "third_party_playlisting",
        "ad_box",
        "influencers",
        "labs",
        "luminate",
      ])
    );
  });

  it("does not claim an undocumented TooLost marketing API", () => {
    const providerBacked = MARKETING_SERVICE_SPECS.filter(
      (service) => service.providerMode !== "internal"
    );
    expect(providerBacked.length).toBeGreaterThan(0);
    expect(providerBacked.every((service) => service.providerMode === "toolost_manual")).toBe(true);
  });

  it("keeps release requirements on release-specific workflows", () => {
    for (const kind of [
      "dsp_pitching",
      "campaign",
      "priority_pitch",
      "spotify_discovery_mode",
      "promotional_assets",
      "third_party_playlisting",
      "ad_box",
      "influencers",
      "luminate",
    ]) {
      expect(marketingServiceSpec(kind)?.requiresRelease).toBe(true);
    }
  });
});
