import { describe, expect, it } from "vitest";
import {
  expectedTrackCount,
  validateIsrc,
  validateReleaseForSubmit,
  validateUpc,
} from "./validation";

describe("codes are never fabricated", () => {
  it("validates optional UPC format", () => {
    expect(validateUpc(null)).toBeNull();
    expect(validateUpc("123456789012")).toBeNull();
    expect(validateUpc("ABC")).not.toBeNull();
  });

  it("validates optional ISRC format", () => {
    expect(validateIsrc(null)).toBeNull();
    expect(validateIsrc("USRC17607839")).toBeNull();
    expect(validateIsrc("FAKE")).not.toBeNull();
  });
});

describe("validateReleaseForSubmit", () => {
  const base = {
    release: {
      title: "Song",
      primary_artist_name: "Artist",
      release_type: "single" as const,
      genre: "Pop",
      release_date: "2026-10-01",
      copyright_year: 2026,
      copyright_line: "© 2026 Artist",
      phonogram_line: "℗ 2026 Artist",
      upc: null,
      territories: ["WW"],
    },
    tracks: [{ id: "t1", track_number: 1, title: "Song", isrc: null }],
    assets: [
      { kind: "artwork" as const, track_id: null },
      { kind: "audio" as const, track_id: "t1" },
    ],
    contributors: [{ name: "Artist", role: "primary_artist" as const }],
  };

  it("passes a complete single", () => {
    expect(validateReleaseForSubmit(base)).toEqual([]);
  });

  it("requires artwork and audio", () => {
    const issues = validateReleaseForSubmit({
      ...base,
      assets: [],
    });
    expect(issues.some((i) => i.field === "artwork")).toBe(true);
    expect(issues.some((i) => i.field === "audio")).toBe(true);
  });

  it("enforces track counts by type", () => {
    expect(expectedTrackCount("album")).toEqual({ min: 7, max: 100 });
    const issues = validateReleaseForSubmit({
      ...base,
      release: { ...base.release, release_type: "album" },
    });
    expect(issues.some((i) => i.field === "tracks")).toBe(true);
  });

  it("requires audio linked to each track when track_id is set", () => {
    const issues = validateReleaseForSubmit({
      ...base,
      assets: [
        { kind: "artwork", track_id: null },
        { kind: "audio", track_id: "other" },
      ],
    });
    expect(issues.some((i) => i.field === "track.1.audio")).toBe(true);
  });

  it("rejects AUTO upc tokens", () => {
    const issues = validateReleaseForSubmit({
      ...base,
      release: { ...base.release, upc: "AUTO" },
    });
    expect(issues.some((i) => i.field === "upc")).toBe(true);
  });
});
