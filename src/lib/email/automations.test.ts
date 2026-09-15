import { describe, expect, it } from "vitest";
import { EMAIL_CATALOG } from "./catalog";
import {
  EMAIL_AUTOMATION_SPECS,
  isDormantCatalogKey,
  isHostedAuthAutomation,
} from "./automations";
import { templateKeyForReleaseStatus, templateKeyForReleaseTransition } from "./catalog";

describe("email automations catalog wiring", () => {
  it("covers every NexoBot catalog key", () => {
    const keys = new Set(EMAIL_AUTOMATION_SPECS.map((s) => s.key));
    for (const entry of EMAIL_CATALOG) {
      expect(keys.has(entry.templateKey)).toBe(true);
    }
  });

  it("keeps AUTH hosted by Supabase (not outbox)", () => {
    expect(isHostedAuthAutomation("AUTH_RECOVERY")).toBe(true);
    const recovery = EMAIL_AUTOMATION_SPECS.find((s) => s.key === "AUTH_RECOVERY");
    expect(recovery?.hostedBySupabase).toBe(true);
    expect(recovery?.enabledByDefault).toBe(false);
  });

  it("marks LIVE and DELIVERED dormant until provider events", () => {
    expect(isDormantCatalogKey("RELEASE_LIVE")).toBe(true);
    expect(isDormantCatalogKey("RELEASE_DELIVERED")).toBe(true);
    expect(isDormantCatalogKey("RELEASE_APPROVED")).toBe(false);
    const live = EMAIL_AUTOMATION_SPECS.find((s) => s.key === "RELEASE_LIVE");
    expect(live?.enabledByDefault).toBe(false);
    expect(live?.dormant).toBe(true);
  });

  it("maps the release state machine onto catalog keys", () => {
    expect(templateKeyForReleaseStatus("submitted")).toBe("RELEASE_SUBMITTED");
    expect(templateKeyForReleaseStatus("in_qc")).toBe("RELEASE_UNDER_REVIEW");
    expect(templateKeyForReleaseStatus("approved")).toBe("RELEASE_APPROVED");
    expect(templateKeyForReleaseStatus("scheduled")).toBe("RELEASE_QUEUED");
    expect(templateKeyForReleaseStatus("delivering")).toBe("RELEASE_DISTRIBUTING");
    expect(templateKeyForReleaseStatus("failed")).toBe("RELEASE_FAILED");
    expect(templateKeyForReleaseStatus("draft")).toBe(null);
    expect(templateKeyForReleaseTransition("in_qc", "changes_requested")).toBe(
      "RELEASE_CHANGES_REQUIRED"
    );
    expect(templateKeyForReleaseTransition("approved", "changes_requested")).toBe(
      "RELEASE_UPDATE_REQUIRED"
    );
  });

  it("does not invent LIVE from approved", () => {
    expect(templateKeyForReleaseStatus("approved")).not.toBe("RELEASE_LIVE");
    expect(templateKeyForReleaseTransition("in_qc", "approved")).toBe("RELEASE_APPROVED");
  });
});
