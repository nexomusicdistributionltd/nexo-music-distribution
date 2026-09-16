import { describe, expect, it } from "vitest";
import {
  artistToDirectory,
  labelToDirectory,
  profileToDirectory,
  resolveAdminCampaignRecipients,
} from "./admin-recipients";
import { parseDirectoryKeys } from "./campaign";

describe("admin email directory mapping", () => {
  it("maps users, artists, and labels without inventing emails", () => {
    expect(
      profileToDirectory({
        id: "u1",
        email: "ada@nexo.test",
        display_name: "Ada",
        full_name: "Ada Nexo",
      })
    ).toMatchObject({ key: "user:u1", kind: "user", email: "ada@nexo.test", label: "Ada" });

    expect(
      artistToDirectory(
        { id: "a1", user_id: "u1", stage_name: "Ada", artist_name: "Ada Nexo" },
        "ada@nexo.test"
      )
    ).toMatchObject({ key: "artist:a1", kind: "artist", email: "ada@nexo.test" });

    expect(artistToDirectory({ id: "a2", user_id: null, stage_name: "Roster" }, null).email).toBeNull();

    expect(
      labelToDirectory(
        { id: "l1", user_id: "u2", label_name: "Nexo Label", business_email: "label@nexo.test" },
        "ignored@nexo.test"
      )
    ).toMatchObject({ key: "label:l1", email: "label@nexo.test", label: "Nexo Label" });
  });

  it("parses mixed directory keys", () => {
    const uid = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const aid = "11111111-1111-4111-8111-111111111111";
    const lid = "22222222-2222-4222-8222-222222222222";
    expect(parseDirectoryKeys([`user:${uid}`, `artist:${aid}`, `label:${lid}`, "user:not-uuid"])).toEqual({
      userIds: [uid],
      artistIds: [aid],
      labelIds: [lid],
    });
  });
});

describe("resolveAdminCampaignRecipients", () => {
  const uid = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const aid = "11111111-1111-4111-8111-111111111111";
  const lid = "22222222-2222-4222-8222-222222222222";

  function supabaseMock() {
    return {
      from(table: string) {
        if (table === "profiles") {
          return {
            select: () => ({
              in: async () => ({
                data: [
                  { id: uid, email: "from-db@nexo.test", display_name: "DB User", full_name: "DB User" },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === "artist_profiles") {
          return {
            select: () => ({
              in: async () => ({
                data: [{ id: aid, user_id: uid, profile_id: uid, stage_name: "Ada", artist_name: "Ada" }],
                error: null,
              }),
            }),
          };
        }
        if (table === "label_profiles") {
          return {
            select: () => ({
              in: async () => ({
                data: [
                  {
                    id: lid,
                    user_id: uid,
                    label_name: "Nexo Label",
                    business_email: "label@nexo.test",
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        throw new Error(table);
      },
    };
  }

  it("uses typed custom emails on the admin send path", async () => {
    const r = await resolveAdminCampaignRecipients(supabaseMock() as never, {
      customEmails: ["Ops@Nexo.TEST", "bad", "ops@nexo.test"],
    });
    expect(r.recipients).toEqual([
      expect.objectContaining({ email: "ops@nexo.test", source: "admin_explicit", userId: null }),
    ]);
  });

  it("resolves artists, labels, users, and custom emails together and dedupes", async () => {
    const r = await resolveAdminCampaignRecipients(supabaseMock() as never, {
      userIds: [uid],
      artistIds: [aid],
      labelIds: [lid],
      customEmails: ["from-db@nexo.test", "extra@nexo.test"],
    });
    const emails = r.recipients.map((x) => x.email).sort();
    expect(emails).toEqual(["extra@nexo.test", "from-db@nexo.test", "label@nexo.test"]);
    expect(r.recipients.find((x) => x.email === "extra@nexo.test")?.source).toBe("admin_explicit");
  });
});
