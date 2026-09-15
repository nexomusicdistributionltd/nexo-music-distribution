import { describe, expect, it } from "vitest";
import {
  assertEnqueueableTemplateKey,
  assertOutboundTemplateKey,
  ensureUniqueTemplateKey,
  isAuthTemplateKey,
  isValidTemplateKeyFormat,
  slugifyTemplateKey,
} from "./template-keys";

describe("template keys", () => {
  it("accepts uppercase snake keys", () => {
    expect(isValidTemplateKeyFormat("NEW_MUSIC_FRIDAY")).toBe(true);
    expect(isValidTemplateKeyFormat("custom")).toBe(false);
    expect(isValidTemplateKeyFormat("A")).toBe(false);
  });

  it("refuses Auth keys for the outbox", () => {
    expect(isAuthTemplateKey("AUTH_CONFIRMATION")).toBe(true);
    expect(() => assertEnqueueableTemplateKey("AUTH_MAGIC_LINK")).toThrow(/Supabase/);
    expect(assertEnqueueableTemplateKey("NEWSLETTER")).toBe("NEWSLETTER");
    expect(assertEnqueueableTemplateKey("CUSTOM_HELLO")).toBe("CUSTOM_HELLO");
  });

  it("slugifies names and avoids AUTH_ / collisions", () => {
    expect(slugifyTemplateKey("New Music Friday")).toBe("NEW_MUSIC_FRIDAY");
    expect(slugifyTemplateKey("Auth surprise")).toBe("CUSTOM_AUTH_SURPRISE");
    expect(assertEnqueueableTemplateKey(slugifyTemplateKey("Auth surprise"))).toBe(
      "CUSTOM_AUTH_SURPRISE"
    );
    expect(ensureUniqueTemplateKey("NEWSLETTER", ["NEWSLETTER"])).toBe("NEWSLETTER_2");
    expect(ensureUniqueTemplateKey("AUTH_X", [])).toBe("CUSTOM_AUTH_X");
  });

  it("allows existing operational outbox keys for retry", () => {
    expect(assertOutboundTemplateKey("newsletter_campaign")).toBe("newsletter_campaign");
    expect(assertOutboundTemplateKey("ADMIN_COMPOSE")).toBe("ADMIN_COMPOSE");
    expect(() => assertOutboundTemplateKey("AUTH_CONFIRMATION")).toThrow(/Supabase/);
  });
});
