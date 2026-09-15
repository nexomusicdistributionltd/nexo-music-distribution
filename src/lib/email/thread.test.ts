import { describe, expect, it } from "vitest";
import { buildReplyHeaders, replySubject, threadKeyFromHeaders } from "./thread";

describe("threadKeyFromHeaders", () => {
  it("uses References root, then In-Reply-To, then Message-ID", () => {
    expect(
      threadKeyFromHeaders({
        messageId: "<c@nexo>",
        inReplyTo: "<b@nexo>",
        references: "<a@nexo> <b@nexo>",
      })
    ).toBe("a@nexo");
    expect(
      threadKeyFromHeaders({ messageId: "<c@nexo>", inReplyTo: "<b@nexo>" })
    ).toBe("b@nexo");
    expect(threadKeyFromHeaders({ messageId: "<c@nexo>" })).toBe("c@nexo");
  });
});

describe("buildReplyHeaders", () => {
  it("preserves Message-ID chain", () => {
    const h = buildReplyHeaders({
      originalMessageId: "<b@nexo>",
      originalReferences: "<a@nexo>",
    });
    expect(h.inReplyTo).toBe("<b@nexo>");
    expect(h.references).toBe("<a@nexo> <b@nexo>");
  });

  it("prefixes Re: once", () => {
    expect(replySubject("Hello")).toBe("Re: Hello");
    expect(replySubject("Re: Hello")).toBe("Re: Hello");
  });
});
