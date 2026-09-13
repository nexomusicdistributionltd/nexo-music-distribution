import { describe, expect, it } from "vitest";
import {
  ARTWORK_BUCKET,
  AUDIO_BUCKET,
  assertArtworkFile,
  assertAudioFile,
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

  it("rejects bad mime / oversized files", () => {
    expect(assertAudioFile({ type: "application/pdf", size: 10 })).toMatch(/Unsupported/);
    expect(assertArtworkFile({ type: "image/gif", size: 10 })).toMatch(/Artwork must/);
    expect(assertAudioFile({ type: "audio/wav", size: 0 })).toMatch(/empty/);
  });
});
