import { describe, expect, it } from "vitest";
import {
  assertApprovedTemplateKey,
  getCatalogEntry,
  isApprovedTemplateKey,
  templateKeyForReleaseStatus,
  templateKeysForQcDecision,
  EMAIL_CATALOG,
} from "./catalog";

describe("template allowlist", () => {
  it("accepts approved keys only", () => {
    expect(isApprovedTemplateKey("RELEASE_APPROVED")).toBe(true);
    expect(isApprovedTemplateKey("NOT_A_REAL_KEY")).toBe(false);
    expect(() => assertApprovedTemplateKey("HACK")).toThrow(/Unauthorized/);
  });

  it("maps catalog entries to files", () => {
    const entry = getCatalogEntry("RELEASE_SUBMITTED");
    expect(entry?.filePath).toBe("emails/templates/RELEASE_SUBMITTED.html");
    expect(entry?.subject.toLowerCase()).toContain("submitted");
  });

  it("marks LIVE/DELIVERED dormant", () => {
    expect(getCatalogEntry("RELEASE_LIVE")?.dormant).toBe(true);
    expect(getCatalogEntry("RELEASE_DELIVERED")?.dormant).toBe(true);
  });

  it("includes AUTH, operational, and newsletter keys", () => {
    const keys = new Set(EMAIL_CATALOG.map((e) => e.templateKey));
    expect(keys.has("AUTH_CONFIRMATION")).toBe(true);
    expect(keys.has("CONTACT_ACKNOWLEDGEMENT")).toBe(true);
    expect(keys.has("NEWSLETTER")).toBe(true);
    expect(keys.has("NEW_MUSIC_FRIDAY")).toBe(true);
    expect(getCatalogEntry("NEW_MUSIC_FRIDAY")?.filePath).toBe(
      "emails/templates/NEW_MUSIC_FRIDAY.html"
    );
  });
});

describe("approval mapping", () => {
  it("maps QC decisions", () => {
    expect(templateKeysForQcDecision("approve")).toEqual(["RELEASE_APPROVED"]);
    expect(templateKeysForQcDecision("request_changes")).toEqual([
      "RELEASE_CHANGES_REQUIRED",
    ]);
    expect(templateKeysForQcDecision("reject")).toEqual(["RELEASE_REJECTED"]);
  });

  it("maps release statuses without inventing LIVE from approved", () => {
    expect(templateKeyForReleaseStatus("approved")).toBe("RELEASE_APPROVED");
    expect(templateKeyForReleaseStatus("live")).toBe("RELEASE_LIVE");
    expect(templateKeyForReleaseStatus("draft")).toBe(null);
  });
});
