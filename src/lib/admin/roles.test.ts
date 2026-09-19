import { describe, expect, it } from "vitest";
import { evaluateRoleAssignment, normalizeRoleList } from "./roles";

const base = {
  actorId: "admin-1",
  targetId: "user-1",
  currentRoles: ["artist"] as Array<"artist">,
  nextRoles: ["artist", "support"] as const,
  superAdminCount: 2,
  hasLabelRoster: false,
  hasArtistOwnedReleases: false,
};

describe("evaluateRoleAssignment", () => {
  it("assigns artist/label/support/admin without mixing artist+label", () => {
    const ok = evaluateRoleAssignment({ ...base, nextRoles: ["label", "admin"] });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.roles).toEqual(["label", "admin"]);
    const mixed = evaluateRoleAssignment({ ...base, nextRoles: ["artist", "label"] });
    expect(mixed.ok).toBe(false);
  });

  it("prevents last super_admin lockout and self-demotion", () => {
    const last = evaluateRoleAssignment({
      ...base,
      currentRoles: ["super_admin"],
      nextRoles: ["admin"],
      superAdminCount: 1,
    });
    expect(last.ok).toBe(false);
    if (!last.ok) expect(last.error).toMatch(/last super_admin/i);

    const self = evaluateRoleAssignment({
      ...base,
      actorId: "admin-1",
      targetId: "admin-1",
      currentRoles: ["super_admin"],
      nextRoles: ["admin"],
      superAdminCount: 3,
    });
    expect(self.ok).toBe(false);

    const ok = evaluateRoleAssignment({
      ...base,
      currentRoles: ["super_admin"],
      nextRoles: ["super_admin", "admin"],
      superAdminCount: 1,
    });
    expect(ok.ok).toBe(true);
  });

  it("does not casually break label roster or artist catalog ownership", () => {
    const roster = evaluateRoleAssignment({
      ...base,
      currentRoles: ["label"],
      nextRoles: ["artist"],
      hasLabelRoster: true,
    });
    expect(roster.ok).toBe(false);

    const catalog = evaluateRoleAssignment({
      ...base,
      currentRoles: ["artist"],
      nextRoles: ["label"],
      hasArtistOwnedReleases: true,
    });
    expect(catalog.ok).toBe(false);
  });

  it("normalizes assignable roles and rejects public_user", () => {
    expect(normalizeRoleList(["artist", "artist", "public_user"])).toEqual(["artist"]);
    const bad = evaluateRoleAssignment({ ...base, nextRoles: ["public_user"] as never });
    expect(bad.ok).toBe(false);
  });
});
