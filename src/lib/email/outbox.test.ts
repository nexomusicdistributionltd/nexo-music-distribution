import { describe, expect, it } from "vitest";
import type { EmailProvider } from "./types";

/**
 * Provider failure / null provider behavior (unit-level).
 * Full processEmailEvent needs Supabase; here we assert provider contract used by outbox.
 */
import { NullEmailProvider } from "./providers/null-provider";

describe("outbox provider outcomes", () => {
  it("null provider → UNAVAILABLE semantics", async () => {
    const r = await new NullEmailProvider("unconfigured").send({
      to: "x@y.z",
      subject: "s",
      html: "h",
    });
    expect(r.accepted).toBe(false);
    expect(r.unavailable).toBe(true);
    // outbox maps this to status unavailable — never sent
  });

  it("provider failure → FAILED semantics (accepted false, not unavailable)", async () => {
    const failing: EmailProvider = {
      name: "mock",
      send: async () => ({
        accepted: false,
        provider: "mock",
        error: "boom",
      }),
    };
    const r = await failing.send({
      to: "x@y.z",
      subject: "s",
      html: "h",
    });
    expect(r.accepted).toBe(false);
    expect(r.unavailable).toBeUndefined();
    expect(r.error).toBe("boom");
  });
});
