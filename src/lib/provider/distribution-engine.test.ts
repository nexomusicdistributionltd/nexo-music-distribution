import { beforeEach, describe, expect, it, vi } from "vitest";
import { DistributionEngineProvider } from "./distribution-engine";
import { groupProviderContributors } from "./participant-mapping";
import type { ProviderReleasePayload } from "./types";

const state = vi.hoisted(() => ({ remembered: null as string | null }));
vi.mock("./oauth/store", () => ({ loadDistributionAccessToken: async () => "test-token" }));
vi.mock("./oauth/config", () => ({ readDistributionOAuthConfig: () => ({ apiBaseUrl: "https://api.toolost.test/v1" }) }));
vi.mock("@/lib/supabase/admin", () => ({
  createServiceClient: () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: state.remembered ? { provider_release_id: state.remembered } : null }),
        upsert: async () => ({ error: null }),
      };
      return query;
    },
    storage: { from: () => ({
      createSignedUrl: async () => ({ data: { signedUrl: "https://storage.test/cover.jpg" } }),
      download: async () => ({ data: new Blob(["fLaC-test"]), error: null }),
    }) },
  }),
}));

const payload = (): ProviderReleasePayload => ({
  releaseId: "local-1", title: "Song", type: "single", primaryArtistName: "Artist",
  releaseDate: "2026-10-01", artworkStorageBucket: "covers", artworkStoragePath: "cover.jpg",
  tracks: [{
    trackNumber: 1, title: "Song", audioStorageBucket: "audio", audioStoragePath: "song.flac",
    audioMimeType: "audio/flac", tiktokStartTime: "0:08",
    writers: groupProviderContributors([{ name: "Writer", role: "composer" }, { name: "Writer", role: "lyricist" }]),
  }],
});
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

beforeEach(() => { state.remembered = null; vi.unstubAllGlobals(); });

describe("TooLost documented delivery contract", () => {
  it("uploads FLAC then sends documented writer roles and submits the draft", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith("/tracks/upload-url")) return json({ data: { uploadUrl: "https://storage.test/upload", fileKey: "audio/song.flac" } });
      if (url.endsWith("/releases")) return json({ data: { id: 42 } });
      return json({ data: { id: 42 } });
    }));
    await expect(new DistributionEngineProvider().submitRelease(payload())).resolves.toEqual({ providerReleaseId: "42" });
    const trackCall = calls.find((call) => call.url.endsWith("/tracks"))!;
    const track = JSON.parse(String(trackCall.init?.body)).tracks[0];
    expect(track.writers).toEqual([{ name: "Writer", role: ["instrumentalist", "lyricist"] }]);
    expect(track.audioFileKey).toBe("audio/song.flac");
    expect(track.tiktokStartTime).toBe("00:08");
    const upload = calls.find((call) => call.url === "https://storage.test/upload")!;
    expect(upload.init?.method).toBe("PUT");
    expect(new Headers(upload.init?.headers).get("Content-Type")).toBe("audio/flac");
    expect(new Headers(upload.init?.headers).has("Authorization")).toBe(false);
    expect(calls.some((call) => call.url.endsWith("/submit"))).toBe(true);
  });

  it("rejects missing composer credits before spending any API calls", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const input = payload(); input.tracks[0].writers = [{ name: "Writer", role: ["lyricist"] }];
    await expect(new DistributionEngineProvider().submitRelease(input)).rejects.toThrow("songwriter or composer");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not overwrite a release already in review", async () => {
    state.remembered = "42";
    const fetcher = vi.fn(async () => json({ data: { id: 42, status: "in_review" } }));
    vi.stubGlobal("fetch", fetcher);
    await expect(new DistributionEngineProvider().submitRelease(payload())).rejects.toThrow("no longer a draft");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]).toBeDefined();
  });

  it("preserves provider field errors without silently removing preview settings", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith("/tracks/upload-url")) return json({ data: { uploadUrl: "https://storage.test/upload", fileKey: "audio/song.flac" } });
      if (url.endsWith("/tracks")) return json({ errors: { "tracks.0.tiktokStartTime": ["Invalid preview offset"] } }, 422);
      return json({ data: { id: 42 } });
    });
    vi.stubGlobal("fetch", fetcher);
    await expect(new DistributionEngineProvider().submitRelease(payload())).rejects.toThrow("tracks.0.tiktokStartTime: Invalid preview offset");
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith("/tracks"))).toHaveLength(1);
    expect(fetcher.mock.calls.some(([url]) => url.endsWith("/submit"))).toBe(false);
  });
});
