import { describe, expect, it } from "vitest";
import {
  campaignIdempotencyKey,
  eventTypeForTemplateCategory,
  parseSelectedUserIds,
  sendOutcomeMessage,
  summarizeSendResults,
} from "./campaign";

describe("campaign send helpers", () => {
  it("builds per-recipient idempotency keys", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(campaignIdempotencyKey("camp-1", id)).toBe(`MANUAL_SEND:camp-1:${id}`);
  });

  it("maps category to event type", () => {
    expect(eventTypeForTemplateCategory("newsletter")).toBe("newsletter");
    expect(eventTypeForTemplateCategory("custom")).toBe("manual.send");
    expect(eventTypeForTemplateCategory("ops")).toBe("manual.send");
  });

  it("parses UUID user ids and ignores emails", () => {
    const uid = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    expect(parseSelectedUserIds([uid, "not-an-email-trust", "user@nexo.test"])).toEqual([
      uid,
    ]);
  });

  it("summarizes truthful statuses without inventing sent", () => {
    const counts = summarizeSendResults([
      { status: "unavailable" },
      { status: "unavailable" },
      { status: "pending" },
    ]);
    expect(counts.sent).toBe(0);
    expect(counts.unavailable).toBe(2);
    expect(sendOutcomeMessage(counts, false)).toMatch(/not configured/);
    expect(sendOutcomeMessage(counts, false)).not.toMatch(/delivered/i);
  });
});
