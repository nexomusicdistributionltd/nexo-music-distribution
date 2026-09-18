import { describe, expect, it } from "vitest";
import {
  detectMetadataGaps,
  validateMoveInItems,
  parseCatalogJson,
  parseCatalogCsv,
  resolveImportMethod,
} from "./move-in";

describe("detectMetadataGaps", () => {
  it("flags missing fields without inventing data", () => {
    expect(detectMetadataGaps({})).toEqual(
      expect.arrayContaining(["missing_title", "missing_upc", "missing_isrc", "missing_artist"])
    );
  });

  it("flags invalid upc/isrc", () => {
    const gaps = detectMetadataGaps({
      title: "Song",
      artist_name: "A",
      upc: "123",
      isrcs: ["BAD"],
    });
    expect(gaps).toContain("invalid_upc");
    expect(gaps).toContain("invalid_isrc");
  });

  it("reads track ISRCs when validating JSON imports", () => {
    const gaps = detectMetadataGaps({
      title: "Album",
      artist_name: "Artist",
      upc: "123456789012",
      tracks: [{ title: "One", isrc: "USRC17607839", track_number: 1 }],
    });
    expect(gaps).not.toContain("missing_isrc");
  });
});

describe("validateMoveInItems duplicate protection", () => {
  it("detects ISRC/UPC duplicates", () => {
    const result = validateMoveInItems(
      [
        {
          title: "Same",
          artist_name: "Artist",
          upc: "123456789012",
          isrcs: ["USRC17607839"],
        },
      ],
      {
        tracks: [
          {
            trackId: "t1",
            releaseId: "r1",
            title: "Existing",
            isrc: "USRC17607839",
          },
        ],
        releases: [
          {
            releaseId: "r1",
            title: "Existing",
            upc: "123456789012",
            primaryArtistName: "Artist",
          },
        ],
      }
    );
    expect(result[0].duplicates.some((d) => d.kind === "isrc")).toBe(true);
    expect(result[0].duplicates.some((d) => d.kind === "upc")).toBe(true);
  });
});

describe("parseCatalogJson / CSV", () => {
  it("parses array JSON", () => {
    const items = parseCatalogJson('[{"title":"A","artist_name":"B"}]');
    expect(items[0].title).toBe("A");
  });

  it("parses CSV with multi-track metadata", () => {
    const csv =
      "title,artist_name,upc,isrcs,track_titles\nAlbum,World,123456789012,USRC17607839|USRC17607840,One|Two";
    const items = parseCatalogCsv(csv);
    expect(items[0].title).toBe("Album");
    expect(items[0].isrcs).toEqual(["USRC17607839", "USRC17607840"]);
    expect(items[0].tracks).toEqual([
      { title: "One", isrc: "USRC17607839", track_number: 1 },
      { title: "Two", isrc: "USRC17607840", track_number: 2 },
    ]);
  });
});

describe("resolveImportMethod", () => {
  it("falls back when external API not configured", () => {
    expect(resolveImportMethod("external_api", false)).toBe("unconfigured");
    expect(resolveImportMethod("external_api", true)).toBe("external_api");
    expect(resolveImportMethod("manual")).toBe("manual");
  });
});
