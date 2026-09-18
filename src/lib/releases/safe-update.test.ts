import { describe, expect, it } from "vitest";
import { pickReleaseUpdateFields, sanitizeReleaseSearchQuery } from "./safe-update";
import { applyUpcPreserveGuard } from "./identifiers";

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

  it("strips client-supplied provider fields from distribution settings", () => {
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
    });
    expect(safe.distribution_settings as object).not.toHaveProperty("provider");
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

describe("UPC never overwrite on update", () => {
  it("drops upc from patch when existing UPC is set", () => {
    const safe = pickReleaseUpdateFields({ title: "T", upc: "999999999999" });
    const guarded = applyUpcPreserveGuard(safe, "123456789012");
    expect(guarded).toEqual({ title: "T" });
  });
});
