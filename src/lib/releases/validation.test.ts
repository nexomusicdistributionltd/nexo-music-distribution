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
    tracks: [{ id: "t1", track_number: 1, title: "Song", isrc: null, duration_ms: 180000 }],
    assets: [
      { kind: "artwork" as const, track_id: null, mime_type: "image/jpeg", filename: "cover.jpg" },
      { kind: "audio" as const, track_id: "t1", mime_type: "audio/flac", filename: "song.flac" },
    ],
    contributors: [
      { name: "Artist", role: "primary_artist" as const, track_id: null },
      { name: "Writer", role: "songwriter" as const, track_id: null },
      { name: "Producer", role: "producer" as const, track_id: null },
    ],
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

  it("requires provider-compatible lossless audio", () => {
    const issues = validateReleaseForSubmit({
      ...base,
      assets: [
        { kind: "artwork", track_id: null, mime_type: "image/jpeg", filename: "cover.jpg" },
        { kind: "audio", track_id: "t1", mime_type: "audio/mpeg", filename: "song.mp3" },
      ],
    });
    expect(issues.some((i) => i.field === "audio" && i.message.includes("FLAC"))).toBe(true);
  });

  it("enforces track counts by type", () => {
    expect(expectedTrackCount("album")).toEqual({ min: 1, max: 100 });
    const issues = validateReleaseForSubmit({
      ...base,
      release: { ...base.release, release_type: "album" },
    });
    expect(issues.some((i) => i.field === "tracks")).toBe(true);
  });

  it("uses distribution duration rules for EP and album classification", () => {
    const longEp = validateReleaseForSubmit({
      ...base,
      release: { ...base.release, release_type: "ep" },
      tracks: [
        {
          ...base.tracks[0],
          duration_ms: 11 * 60 * 1000,
        },
      ],
    });
    expect(longEp.some((i) => i.field === "tracks")).toBe(false);

    const shortAlbum = validateReleaseForSubmit({
      ...base,
      release: { ...base.release, release_type: "album" },
      tracks: [
        {
          ...base.tracks[0],
          duration_ms: 5 * 60 * 1000,
        },
      ],
    });
    expect(shortAlbum.some((i) => i.field === "tracks")).toBe(true);

    const longAlbum = validateReleaseForSubmit({
      ...base,
      release: { ...base.release, release_type: "album" },
      tracks: [
        {
          ...base.tracks[0],
          duration_ms: 31 * 60 * 1000,
        },
      ],
    });
    expect(longAlbum.some((i) => i.field === "tracks")).toBe(false);
  });

  it("requires audio linked to each track when track_id is set", () => {
    const issues = validateReleaseForSubmit({
      ...base,
      assets: [
        { kind: "artwork", track_id: null, mime_type: "image/jpeg", filename: "cover.jpg" },
        { kind: "audio", track_id: "other", mime_type: "audio/flac", filename: "other.flac" },
      ],
    });
    expect(issues.some((i) => i.field === "track.1.audio")).toBe(true);
  });

  it("requires a composition credit for music tracks", () => {
    const issues = validateReleaseForSubmit({
      ...base,
      contributors: [
        { name: "Artist", role: "primary_artist", track_id: null },
      ],
    });
    expect(
      issues.some(
        (i) =>
          i.field === "track.1.contributors" &&
          i.message.includes("songwriter or composer")
      )
    ).toBe(true);
  });

  it("ignores stale non-FLAC assets when a valid FLAC exists for the same track", () => {
    const issues = validateReleaseForSubmit({
      ...base,
      assets: [
        { kind: "artwork", track_id: null, mime_type: "image/jpeg", filename: "cover.jpg" },
        { kind: "audio", track_id: "t1", mime_type: "audio/mpeg", filename: "old.mp3" },
        { kind: "audio", track_id: "t1", mime_type: "audio/flac", filename: "current.flac" },
      ],
    });
    expect(issues.some((i) => i.field === "track.1.audio")).toBe(false);
  });

  it("accepts a .flac filename when an old browser MIME was stored", () => {
    const issues = validateReleaseForSubmit({
      ...base,
      assets: [
        { kind: "artwork", track_id: null, mime_type: "image/jpeg", filename: "cover.jpg" },
        { kind: "audio", track_id: "t1", mime_type: "application/octet-stream", filename: "song.flac" },
      ],
    });
    expect(issues.some((i) => i.field === "track.1.audio")).toBe(false);
  });

  it("rejects AUTO upc tokens", () => {
    const issues = validateReleaseForSubmit({
      ...base,
      release: { ...base.release, upc: "AUTO" },
    });
    expect(issues.some((i) => i.field === "upc")).toBe(true);
  });
});
