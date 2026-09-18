import { afterEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  extractWebhookEventId,
  extractWebhookEventType,
  verifyProviderWebhookSignature,
} from "./webhook";
import { mapProviderStatusToRelease } from "./types";

describe("webhook signature verification", () => {
  afterEach(() => {
    delete process.env.PROVIDER_WEBHOOK_SECRET;
  });

  it("fails closed when secret missing", async () => {
    delete process.env.PROVIDER_WEBHOOK_SECRET;
    const r = await verifyProviderWebhookSignature({ rawBody: "{}", signatureHeader: "abc" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not configured|fail closed/i);
  });

  it("rejects missing signature when secret set", async () => {
    process.env.PROVIDER_WEBHOOK_SECRET = "test-secret";
    const r = await verifyProviderWebhookSignature({ rawBody: "{}", signatureHeader: null });
    expect(r.ok).toBe(false);
  });

  it("accepts valid hmac signature", async () => {
    process.env.PROVIDER_WEBHOOK_SECRET = "test-secret";
    const body = JSON.stringify({ id: "evt_1", type: "live" });
    const sig = createHmac("sha256", "test-secret").update(body, "utf8").digest("hex");
    const r = await verifyProviderWebhookSignature({
      rawBody: body,
      signatureHeader: `sha256=${sig}`,
    });
    expect(r.ok).toBe(true);
  });

  it("extracts event id and type", () => {
    expect(extractWebhookEventId({ event_id: "e1" })).toBe("e1");
    expect(extractWebhookEventId({ id: "e2" })).toBe("e2");
    expect(extractWebhookEventId({})).toBeNull();
    expect(extractWebhookEventType({ type: "delivered" })).toBe("delivered");
  });

  it("maps provider statuses safely without inventing", () => {
    expect(mapProviderStatusToRelease("live")).toBe("live");
    expect(mapProviderStatusToRelease("DELIVERED")).toBe("delivered");
    expect(mapProviderStatusToRelease("totally_made_up")).toBeNull();
  });
});
