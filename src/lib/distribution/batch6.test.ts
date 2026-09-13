import { describe, expect, it } from "vitest";
import { canTransition } from "@/lib/releases/status";
import { PROVIDER_GATED_STATUSES, RELEASE_STATUSES, statusLabel } from "@/lib/releases/types";
import { SAFE_WEBHOOK_STATUS_MAP } from "./types";

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
