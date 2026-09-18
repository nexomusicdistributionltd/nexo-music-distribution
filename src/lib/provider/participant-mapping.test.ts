import { describe, expect, it } from "vitest";
import {
  groupProviderContributors,
  providerRoleForContributor,
} from "./participant-mapping";

describe("TooLost participant role mapping", () => {
  it("maps Nexo rich roles to accepted provider roles", () => {
    expect(providerRoleForContributor("primary_artist")).toBe("primary");
    expect(providerRoleForContributor("featured_artist")).toBe("featuring");
    expect(providerRoleForContributor("background_vocals")).toBe("performer");
    expect(providerRoleForContributor("songwriter")).toBe("composer");
    expect(providerRoleForContributor("lyricist")).toBe("author");
    expect(providerRoleForContributor("recording_engineer")).toBeNull();
  });

  it("groups multiple accepted roles for one person and drops unsupported provider roles", () => {
    expect(
      groupProviderContributors([
        { name: "Writer", role: "composer" },
        { name: "Writer", role: "lyricist" },
        { name: "Engineer", role: "recording_engineer" },
      ])
    ).toEqual([{ name: "Writer", role: ["composer", "author"] }]);
  });
});
