import { describe, expect, it } from "vitest";
import {
  EXISTING_TRACK_PROMPT,
  detectTrackDuplicates,
  hasOpenConflict,
} from "./duplicates";

describe("duplicate detection", () => {
  it("detects ISRC match with existing-track prompt", () => {
    const matches = detectTrackDuplicates({
      isrcs: ["USRC12300001"],
      existingTracks: [
        {
          trackId: "t1",
          releaseId: "r1",
          title: "Song",
          isrc: "USRC12300001",
        },
      ],
    });
    expect(matches[0]?.kind).toBe("isrc");
    expect(matches[0]?.message).toContain(EXISTING_TRACK_PROMPT);
    expect(hasOpenConflict(matches)).toBe(true);
  });

  it("detects UPC and fingerprint duplicates", () => {
    const matches = detectTrackDuplicates({
      upc: "060254781123",
      audioHash: "abc",
      existingTracks: [
        { trackId: "t1", releaseId: "r1", title: "A", audioHash: "abc" },
      ],
      existingReleases: [
        { releaseId: "r2", title: "Album", upc: "060254781123" },
      ],
    });
    expect(matches.some((m) => m.kind === "fingerprint")).toBe(true);
    expect(matches.some((m) => m.kind === "upc")).toBe(true);
  });

  it("returns empty when no overlap", () => {
    expect(
      detectTrackDuplicates({
        isrcs: ["USRC12300001"],
        existingTracks: [],
        existingReleases: [],
      })
    ).toEqual([]);
  });
});
