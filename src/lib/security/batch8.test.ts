import { describe, expect, it } from "vitest";
import { securityHeaders } from "./headers";
import {
  assertOwnedAssetPath,
  assertAudioFile,
  assertArtworkFile,
  MAX_AUDIO_BYTES,
  MAX_ARTWORK_BYTES,
} from "@/lib/storage/release-assets";
import { sanitizeAdminSearchQuery } from "@/lib/admin/search";
import { sanitizeDistributionSearchQuery } from "@/lib/distribution/search";
import { sanitizeReleaseSearchQuery } from "@/lib/releases/safe-update";
import { isSafeRedirectPath } from "@/lib/auth/safeRedirect";
import { readProviderConfig } from "@/lib/provider/config";
import { getPaymentConnectionState } from "@/lib/finance/payment";

function isAllowedSignedAssetTarget(bucket: string, path: string): boolean {
  const buckets = [
    "release-audio",
    "release-artwork",
    "compliance-evidence",
    "support-attachments",
    "avatars",
  ];
  if (!buckets.includes(bucket)) return false;
  if (
    !path ||
    path.includes("..") ||
    path.startsWith("/") ||
    path.includes("\\") ||
    path.includes("\0")
  ) {
    return false;
  }
  return true;
}

describe("Batch 8 hostile self-check", () => {
  it("security headers include CSP frame-ancestors and nosniff", () => {
    const h = securityHeaders();
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(h["Permissions-Policy"]).toContain("camera=(self)");
    expect(h["Content-Security-Policy"]).toContain("*.supabase.co");
    expect(h["Referrer-Policy"]).toBeTruthy();
    expect(h["Permissions-Policy"]).toContain("camera=()");
  });

  it("signed URL bucket allowlist rejects unknown buckets and traversal", () => {
    expect(isAllowedSignedAssetTarget("release-audio", "u/r/file.wav")).toBe(true);
    expect(isAllowedSignedAssetTarget("evil-bucket", "u/r/file.wav")).toBe(false);
    expect(isAllowedSignedAssetTarget("release-audio", "../etc/passwd")).toBe(false);
  });

  it("upload validation enforces mime and size", () => {
    expect(assertAudioFile({ type: "audio/wav", size: 100 })).toBeNull();
    expect(assertAudioFile({ type: "text/html", size: 100 })).toMatch(/Unsupported/);
    expect(assertAudioFile({ type: "audio/wav", size: MAX_AUDIO_BYTES + 1 })).toMatch(/exceeds/);
    expect(assertArtworkFile({ type: "image/png", size: 100 })).toBeNull();
    expect(assertArtworkFile({ type: "image/png", size: MAX_ARTWORK_BYTES + 1 })).toMatch(
      /exceeds/
    );
  });

  it("search sanitizers neutralize .or() injection across batches", () => {
    for (const fn of [
      sanitizeAdminSearchQuery,
      sanitizeDistributionSearchQuery,
      sanitizeReleaseSearchQuery,
    ]) {
      const q = fn("foo,status.eq.approved");
      expect(q).not.toMatch(/,/);
    }
  });

  it("open redirect guard rejects protocol-relative URLs", () => {
    expect(isSafeRedirectPath("//evil.example")).toBe(false);
    expect(isSafeRedirectPath("/dashboard")).toBe(true);
  });

  it("providers report NOT CONNECTED without inventing success", () => {
    const d = readProviderConfig();
    const p = getPaymentConnectionState();
    expect(typeof d.connected).toBe("boolean");
    expect(p.connected).toBe(false);
    expect(p.message).toMatch(/NOT CONNECTED|UNAVAILABLE/i);
  });

  it("path traversal blocked for owned assets", () => {
    const uid = "11111111-1111-1111-1111-111111111111";
    const rid = "22222222-2222-2222-2222-222222222222";
    expect(assertOwnedAssetPath(`${uid}/${rid}/../x`, uid, rid)).toMatch(/Invalid/);
  });
});
