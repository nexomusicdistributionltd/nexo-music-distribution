import { describe, expect, it } from "vitest";
import { canMarkOutboundSent, toCanonicalEmailStatus } from "./status";

describe("toCanonicalEmailStatus", () => {
  it("maps PR #5 vocabulary onto email_outbound_events", () => {
    expect(toCanonicalEmailStatus("pending")).toBe("queued");
    expect(toCanonicalEmailStatus("processing")).toBe("queued");
    expect(toCanonicalEmailStatus("queued")).toBe("queued");
    expect(toCanonicalEmailStatus("unavailable")).toBe("skipped");
    expect(toCanonicalEmailStatus("skipped")).toBe("skipped");
    expect(toCanonicalEmailStatus("failed")).toBe("failed");
    expect(toCanonicalEmailStatus("sent")).toBe("sent");
  });
});

describe("canMarkOutboundSent", () => {
  it("requires a real provider and message id", () => {
    expect(canMarkOutboundSent("resend", "msg_123")).toBe(true);
    expect(canMarkOutboundSent("resend", "")).toBe(false);
    expect(canMarkOutboundSent("none", "msg_123")).toBe(false);
    expect(canMarkOutboundSent("null", "msg_123")).toBe(false);
    expect(canMarkOutboundSent("fake", "msg_123")).toBe(false);
    expect(canMarkOutboundSent("test", "x")).toBe(false);
    expect(canMarkOutboundSent("not_connected", "x")).toBe(false);
  });
});
