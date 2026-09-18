import { afterEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  extractProviderReleaseReference,
  extractProviderStatus,
  extractWebhookEventId,
  extractWebhookEventType,
  verifyProviderWebhookSignature,
} from "./webhook";
import { mapProviderStatusToRelease } from "./types";

describe("webhook signature verification", () => {
  afterEach(() => {
    delete process.env.DISTRIBUTION_WEBHOOK_SECRET;
    delete process.env.PROVIDER_WEBHOOK_SECRET;
  });

  it("fails closed when secret missing", () => {
    const r = verifyProviderWebhookSignature({ rawBody: "{}", signatureHeader: "abc" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not configured|fail closed/i);
  });

  it("uses the dedicated Distribution Engine webhook secret", () => {
    process.env.DISTRIBUTION_WEBHOOK_SECRET = "distribution-secret";
    const body = JSON.stringify({ event_id: "evt_1", type: "release.updated" });
    const sig = createHmac("sha256", "distribution-secret").update(body, "utf8").digest("hex");
    const r = verifyProviderWebhookSignature({
      rawBody: body,
      signatureHeader: `sha256=${sig}`,
    });
    expect(r.ok).toBe(true);
  });

  it("keeps the legacy provider webhook secret as a fallback", () => {
    process.env.PROVIDER_WEBHOOK_SECRET = "legacy-secret";
    const body = JSON.stringify({ event_id: "evt_legacy", type: "release.updated" });
    const sig = createHmac("sha256", "legacy-secret").update(body, "utf8").digest("hex");
    const r = verifyProviderWebhookSignature({
      rawBody: body,
      signatureHeader: sig,
    });
    expect(r.ok).toBe(true);
  });

  it("rejects missing signature when secret set", () => {
    process.env.DISTRIBUTION_WEBHOOK_SECRET = "test-secret";
    const r = verifyProviderWebhookSignature({ rawBody: "{}", signatureHeader: null });
    expect(r.ok).toBe(false);
  });

  it("derives a stable body-hash event id when the provider has no explicit event id", () => {
    const body = JSON.stringify({ id: 4821, type: "release.updated", status: "live" });
    const first = extractWebhookEventId(JSON.parse(body), body);
    const second = extractWebhookEventId(JSON.parse(body), body);
    expect(first).toMatch(/^body_[0-9a-f]{64}$/);
    expect(second).toBe(first);
  });

  it("prefers explicit event ids and extracts event type", () => {
    expect(extractWebhookEventId({ event_id: "e1" }, "{}")).toBe("e1");
    expect(extractWebhookEventType({ event_type: "release.updated" })).toBe("release.updated");
    expect(extractWebhookEventType({ data: { eventType: "delivery.updated" } })).toBe(
      "delivery.updated"
    );
  });

  it("extracts provider release references from nested provider payloads", () => {
    expect(extractProviderReleaseReference({ release_id: 4821 })).toBe("4821");
    expect(
      extractProviderReleaseReference({ data: { release: { id: "provider-release-2" } } })
    ).toBe("provider-release-2");
  });

  it("extracts provider status from nested release payloads", () => {
    expect(extractProviderStatus({ status: "live" })).toBe("live");
    expect(extractProviderStatus({ data: { release: { status: "delivered" } } })).toBe(
      "delivered"
    );
  });

  it("maps provider statuses safely without inventing", () => {
    expect(mapProviderStatusToRelease("live")).toBe("live");
    expect(mapProviderStatusToRelease("DELIVERED")).toBe("delivered");
    expect(mapProviderStatusToRelease("totally_made_up")).toBeNull();
  });
});
