
import { describe, expect, it, vi } from "vitest";
import { resolveContactSubmissionRecipient } from "./resolve-recipient";

describe("resolveContactSubmissionRecipient", () => {
  it("labels contact submission source and normalizes email", () => {
    const r = resolveContactSubmissionRecipient("  User@Example.COM ");
    expect(r.email).toBe("user@example.com");
    expect(r.source).toBe("contact_submission");
    expect(r.userId).toBeNull();
  });
});

describe("release owner resolution contract", () => {
  it("never trusts client email — mock documents owner profile source", async () => {
    const { resolveReleaseOwnerRecipient } = await import("./resolve-recipient");
    const supabase = {
      from(table: string) {
        if (table === "releases") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "r1", owner_user_id: "u1", title: "T", primary_artist_name: "A" },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: "u1", email: "owner@nexo.test", display_name: "Owner", full_name: "Owner" },
                  error: null,
                }),
              }),
            }),
          };
        }
        throw new Error(table);
      },
    };
    const r = await resolveReleaseOwnerRecipient(supabase as never, "r1");
    expect(r?.source).toBe("release_owner_profile");
    expect(r?.email).toBe("owner@nexo.test");
  });
});
