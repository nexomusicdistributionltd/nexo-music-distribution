import { describe, expect, it } from "vitest";
import { pickReleaseUpdateFields, sanitizeReleaseSearchQuery } from "./safe-update";

describe("pickReleaseUpdateFields — mass assignment shield", () => {
  it("keeps only allowlisted metadata fields", () => {
    const safe = pickReleaseUpdateFields({
      title: "Ok",
      genre: "Pop",
      status: "approved",
      provider_connected: true,
      provider_name: "fake",
      provider_release_id: "x",
      provider_status: "live",
      provider_metadata: { hack: true },
      locked_at: "2026-01-01",
      submitted_at: "2026-01-01",
      owner_user_id: "other-user",
      rejection_reason: "cleared",
      changes_requested_reason: "cleared",
      artist_profile_id: "foreign",
      label_profile_id: "foreign",
      id: "spoof",
    });
    expect(safe).toEqual({ title: "Ok", genre: "Pop" });
    expect(safe).not.toHaveProperty("status");
    expect(safe).not.toHaveProperty("provider_connected");
    expect(safe).not.toHaveProperty("owner_user_id");
    expect(safe).not.toHaveProperty("rejection_reason");
  });

  it("forces distribution_settings.provider to not_connected", () => {
    const safe = pickReleaseUpdateFields({
      distribution_settings: {
        worldwide: true,
        provider: "spotify",
        provider_connected: true,
        provider_release_id: "abc",
      },
    });
    expect(safe.distribution_settings).toMatchObject({
      worldwide: true,
      provider: "not_connected",
    });
    expect(safe.distribution_settings as object).not.toHaveProperty("provider_connected");
    expect(safe.distribution_settings as object).not.toHaveProperty("provider_release_id");
  });
});

describe("sanitizeReleaseSearchQuery", () => {
  it("strips PostgREST filter metacharacters", () => {
    const cleaned = sanitizeReleaseSearchQuery("foo),status.eq.approved");
    expect(cleaned).not.toMatch(/[%,()]/);
    expect(cleaned).not.toContain("status.eq");
    expect(sanitizeReleaseSearchQuery('a"b\\c')).not.toMatch(/["\\]/);
    expect(sanitizeReleaseSearchQuery("  hello world  ")).toBe("hello world");
  });
});
