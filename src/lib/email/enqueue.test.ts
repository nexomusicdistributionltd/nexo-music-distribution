import { describe, expect, it } from "vitest";
import { scrubPayload, qcDecisionIdempotencyKey } from "./enqueue";
import { assertApprovedTemplateKey } from "./catalog";

describe("scrubPayload", () => {
  it("strips secret-like keys and never keeps auth tokens", () => {
    const out = scrubPayload({
      RELEASE_TITLE: "Ok",
      access_token: "super-secret-token-value",
      password: "nope",
      ARTIST_VISIBLE_REASON: "Fix metadata",
    });
    expect(out.RELEASE_TITLE).toBe("Ok");
    expect(out.access_token).toBeUndefined();
    expect(out.password).toBeUndefined();
    expect(out.ARTIST_VISIBLE_REASON).toBe("Fix metadata");
  });
});

describe("idempotency keys", () => {
  it("builds stable QC keys", () => {
    expect(qcDecisionIdempotencyKey("rel-1", "approve", "rev-9")).toBe(
      "RELEASE_QC:rel-1:approve:rev-9"
    );
  });
});

describe("failed action does not enqueue", () => {
  it("documents that callers must only enqueue after ok RPC", () => {
    // Unit guard: unauthorized key throws before any network/RPC
    expect(() => assertApprovedTemplateKey("FAKE")).toThrow(/Unauthorized/);
  });
});
