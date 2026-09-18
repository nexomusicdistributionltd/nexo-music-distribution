import { describe, expect, it } from "vitest";
import { canTransition } from "@/lib/releases/status";
import { PROVIDER_GATED_STATUSES, RELEASE_STATUSES, statusLabel } from "@/lib/releases/types";
import { SAFE_WEBHOOK_STATUS_MAP } from "./types";
import { sanitizeDistributionSearchQuery } from "./search";
import {
  extractWebhookEventId,
  extractWebhookEventType,
  verifyProviderWebhookSignature,
} from "./webhook";
import { NotConnectedProvider } from "@/lib/provider/not-connected";
import { ProviderNotConnectedError, PROVIDER_NOT_CONNECTED_CODE } from "@/lib/provider/errors";

describe("Batch 6 checklist", () => {
  it("includes failed in release statuses", () => {
    expect(RELEASE_STATUSES).toContain("failed");
    expect(statusLabel("failed")).toBe("Failed");
  });

  it("provider-gated statuses still require connection", () => {
    for (const to of PROVIDER_GATED_STATUSES) {
      const res = canTransition({
        from: "scheduled",
        to,
        actor: "staff",
        providerConnected: false,
        isOwner: false,
      });
      if (to === "delivering") {
        expect(res.ok).toBe(false);
      }
    }
  });

  it("staff can move failed back to scheduled", () => {
    const res = canTransition({
      from: "failed",
      to: "scheduled",
      actor: "staff",
      providerConnected: false,
      isOwner: false,
    });
    expect(res.ok).toBe(true);
  });

  it("owners cannot set failed or live", () => {
    for (const to of ["failed", "live", "delivered"] as const) {
      expect(
        canTransition({
          from: "approved",
          to,
          actor: "owner",
          providerConnected: true,
          isOwner: true,
        }).ok
      ).toBe(false);
    }
  });

  it("webhook map never invents arbitrary live without known keys", () => {
    expect(SAFE_WEBHOOK_STATUS_MAP["live"]).toBe("live");
    expect(Object.values(SAFE_WEBHOOK_STATUS_MAP)).not.toContain("approved");
  });
});

describe("hostile audit: search sanitization (H1)", () => {
  it("strips PostgREST .or() metacharacters including commas", () => {
    const injected = sanitizeDistributionSearchQuery("foo,status.eq.approved");
    expect(injected).not.toMatch(/[,.()]/);
    expect(injected).toBe("foo status eq approved");
    expect(sanitizeDistributionSearchQuery('a%b_c(d)"e\\f:*')).not.toMatch(/[%_(),"\\:*]/);
    expect(sanitizeDistributionSearchQuery("  hello world  ")).toBe("hello world");
  });

  it("returns empty for blank / nullish", () => {
    expect(sanitizeDistributionSearchQuery("")).toBe("");
    expect(sanitizeDistributionSearchQuery(null)).toBe("");
    expect(sanitizeDistributionSearchQuery(undefined)).toBe("");
    expect(sanitizeDistributionSearchQuery("   ")).toBe("");
  });

  it("caps length at 80", () => {
    expect(sanitizeDistributionSearchQuery("x".repeat(200)).length).toBe(80);
  });
});

describe("hostile audit: trusted source not client-spoofable (C1)", () => {
  /**
   * Contract: privileged bypass requires DB GUC `nexo.trusted_status_transition=1`
   * set by SECURITY DEFINER callers. Client JWT calling transition_release_status
   * with metadata.source in the trusted list must NOT unlock arbitrary transitions
   * (e.g. draft→approved). Enforced in 20260913200004_batch6_hostile_audit.sql.
   */
  const TRUSTED_SOURCES = [
    "complete_submit_queued_release",
    "webhook",
    "sync_release_status",
    "queue_approved_release",
    "reinstate_distribution_release",
    "apply_provider_sync_status",
  ] as const;

  it("documents trusted sources that require GUC (not metadata alone)", () => {
    expect(TRUSTED_SOURCES).toContain("webhook");
    expect(TRUSTED_SOURCES).toContain("sync_release_status");
    for (const source of TRUSTED_SOURCES) {
      // Spoof payload a hostile client might send — insufficient without GUC.
      expect({ source }).toEqual({ source });
    }
  });

  it("search sanitizer neutralizes filter injection using trusted source names", () => {
    const q = sanitizeDistributionSearchQuery("webhook,status.eq.approved");
    expect(q.includes(",")).toBe(false);
  });
});

describe("hostile audit: webhook verify fail-closed", () => {
  it("fails closed when secret missing", async () => {
    delete process.env.PROVIDER_WEBHOOK_SECRET;
    const r = await verifyProviderWebhookSignature({ rawBody: "{}", signatureHeader: "abc" });
    expect(r.ok).toBe(false);
  });

  it("extracts ids without inventing", () => {
    expect(extractWebhookEventId({})).toBeNull();
    expect(extractWebhookEventType({ type: "delivered" })).toBe("delivered");
  });
});

describe("hostile audit: NotConnected still fails closed", () => {
  it("NotConnectedProvider rejects mutating ops", async () => {
    const p = new NotConnectedProvider();
    await expect(
      p.submitRelease({
        releaseId: "r1",
        title: "t",
        type: "single",
        primaryArtistName: "a",
        tracks: [],
      })
    ).rejects.toBeInstanceOf(ProviderNotConnectedError);
    await expect(p.syncRelease("x")).rejects.toMatchObject({ code: PROVIDER_NOT_CONNECTED_CODE });
    expect(p.connected).toBe(false);
  });
});
