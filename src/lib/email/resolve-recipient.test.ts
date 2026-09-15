import { describe, expect, it } from "vitest";
import { resolveContactSubmissionRecipient } from "./resolve-recipient";

describe("resolveContactSubmissionRecipient", () => {
  it("labels contact submission source and normalizes email", () => {
    const r = resolveContactSubmissionRecipient("  User@Example.COM ");
    expect(r.email).toBe("user@example.com");
    expect(r.source).toBe("contact_submission");
    expect(r.userId).toBeNull();
  });
});

describe("manual recipients", () => {
  it("resolves from profile rows and ignores extra emails", async () => {
    const { resolveManualRecipients } = await import("./resolve-recipient");
    const uid = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const supabase = {
      from(table: string) {
        if (table !== "profiles") throw new Error(table);
        return {
          select: () => ({
            in: async () => ({
              data: [
                {
                  id: uid,
                  email: "from-db@nexo.test",
                  display_name: "DB User",
                  full_name: "DB User",
                },
              ],
              error: null,
            }),
          }),
        };
      },
    };
    const r = await resolveManualRecipients(supabase as never, {
      userIds: [uid],
    });
    expect(r.recipients).toHaveLength(1);
    expect(r.recipients[0].email).toBe("from-db@nexo.test");
    expect(r.recipients[0].source).toBe("profile");
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
