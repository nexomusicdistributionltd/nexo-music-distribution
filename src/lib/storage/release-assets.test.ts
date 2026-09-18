import { describe, expect, it } from "vitest";
import {
  ARTWORK_BUCKET,
  AUDIO_BUCKET,
  assertArtworkFile,
  assertAudioFile,
  assertOwnedAssetPath,
  buildAssetPath,
} from "./release-assets";

describe("storage auth concepts", () => {
  it("scopes paths under userId/releaseId", () => {
    const path = buildAssetPath({
      userId: "user-1",
      releaseId: "rel-1",
      kind: "audio",
      filename: "track.wav",
      id: "abc",
    });
    expect(path.startsWith("user-1/rel-1/")).toBe(true);
    expect(path).toContain("audio-abc-");
  });

  it("uses private bucket names", () => {
    expect(AUDIO_BUCKET).toBe("release-audio");
    expect(ARTWORK_BUCKET).toBe("release-artwork");
  });

  it("accepts only FLAC audio and still enforces size", () => {
    expect(assertAudioFile({ type: "application/pdf", size: 10, name: "track.pdf" })).toMatch(/FLAC/);
    expect(assertAudioFile({ type: "audio/wav", size: 10, name: "track.wav" })).toMatch(/FLAC/);
    expect(assertAudioFile({ type: "audio/flac", size: 10, name: "track.flac" })).toBeNull();
    expect(assertAudioFile({ type: "audio/x-flac", size: 10, name: "track.flac" })).toBeNull();
    expect(assertArtworkFile({ type: "image/gif", size: 10 })).toMatch(/Artwork must/);
    expect(assertAudioFile({ type: "audio/flac", size: 0, name: "track.flac" })).toMatch(/empty/);
  });

  it("rejects path traversal and cross-user paths", () => {
    const uid = "11111111-1111-1111-1111-111111111111";
    const rid = "22222222-2222-2222-2222-222222222222";
    expect(assertOwnedAssetPath(`${uid}/${rid}/audio-x-file.wav`, uid, rid)).toBeNull();
    expect(
      assertOwnedAssetPath(`${uid}/${rid}/../other/secret.wav`, uid, rid)
    ).toMatch(/Invalid/);
    expect(
      assertOwnedAssetPath(`${uid}/${rid}/nested/evil.wav`, uid, rid)
    ).toMatch(/Invalid/);
    expect(
      assertOwnedAssetPath(`other-user/${rid}/audio-x.wav`, uid, rid)
    ).toMatch(/Invalid/);
    expect(assertOwnedAssetPath(`/${uid}/${rid}/a.wav`, uid, rid)).toMatch(/Invalid/);
    expect(assertOwnedAssetPath(`${uid}/${rid}/a\\b.wav`, uid, rid)).toMatch(/Invalid/);
  });

  it("buildAssetPath rejects id segments with slashes or dots-dots", () => {
    expect(() =>
      buildAssetPath({
        userId: "../evil",
        releaseId: "rel",
        kind: "audio",
        filename: "a.wav",
        id: "1",
      })
    ).toThrow(/Invalid userId/);
  });
});
