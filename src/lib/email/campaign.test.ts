import { describe, expect, it } from "vitest";
import {
  campaignIdempotencyKey,
  eventTypeForTemplateCategory,
  parseDirectoryKeys,
  parseSelectedUserIds,
  sendOutcomeMessage,
  summarizeSendResults,
} from "./campaign";

describe("campaign send helpers", () => {
  it("builds per-recipient idempotency keys including custom emails", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(campaignIdempotencyKey("camp-1", id)).toBe(`MANUAL_SEND:camp-1:${id}`);
    expect(campaignIdempotencyKey("camp-1", "Ops@Nexo.test")).toBe("MANUAL_SEND:camp-1:ops@nexo.test");
  });

  it("maps category to event type", () => {
    expect(eventTypeForTemplateCategory("newsletter")).toBe("newsletter");
    expect(eventTypeForTemplateCategory("custom")).toBe("manual.send");
    expect(eventTypeForTemplateCategory("ops")).toBe("manual.send");
  });

  it("parses directory keys for mixed artist/label/user selections", () => {
    const uid = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const aid = "11111111-1111-4111-8111-111111111111";
    expect(parseSelectedUserIds([uid, "not-an-email-trust", "user@nexo.test"])).toEqual([uid]);
    expect(parseDirectoryKeys([`user:${uid}`, `artist:${aid}`, "user:nope"])).toEqual({
      userIds: [uid],
      artistIds: [aid],
      labelIds: [],
    });
  });

  it("summarizes truthful statuses without inventing sent", () => {
    const counts = summarizeSendResults([
      { status: "unavailable" },
      { status: "skipped" },
      { status: "pending" },
    ]);
    expect(counts.sent).toBe(0);
    expect(counts.skipped).toBe(2);
    expect(counts.queued).toBe(1);
    expect(sendOutcomeMessage(counts, false)).toMatch(/not configured/);
    expect(sendOutcomeMessage(counts, false)).toMatch(/queued or skipped/);
    expect(sendOutcomeMessage(counts, false)).not.toMatch(/delivered/i);
  });
});
