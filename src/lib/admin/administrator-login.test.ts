import { describe, expect, it } from "vitest";
import {
  ADMINISTRATOR_ROLES,
  ADMIN_PORTAL_ROLES,
  evaluateAdministratorLogin,
  isAdminPortalRole,
  isAdministratorRole,
} from "@/lib/admin/permissions";
import type { AppRole } from "@/lib/auth/types";

describe("isAdministratorRole / ADMINISTRATOR_ROLES", () => {
  it("includes only admin and super_admin", () => {
    expect(ADMINISTRATOR_ROLES).toEqual(["admin", "super_admin"]);
    expect(isAdministratorRole(["admin"])).toBe(true);
    expect(isAdministratorRole(["super_admin"])).toBe(true);
    expect(isAdministratorRole(["admin", "artist"])).toBe(true);
  });

  it("denies support, artist, label, public_user, and empty", () => {
    const denied: AppRole[][] = [
      ["support"],
      ["artist"],
      ["label"],
      ["public_user"],
      [],
      ["support", "artist"],
    ];
    for (const roles of denied) {
      expect(isAdministratorRole(roles)).toBe(false);
    }
  });

  it("stays stricter than admin portal roles (support remains portal-eligible)", () => {
    expect(isAdminPortalRole(["support"])).toBe(true);
    expect(isAdministratorRole(["support"])).toBe(false);
    expect(ADMIN_PORTAL_ROLES).toEqual(
      expect.arrayContaining(["admin", "super_admin", "support"])
    );
    expect(ADMINISTRATOR_ROLES).not.toContain("support");
  });
});

describe("evaluateAdministratorLogin gate", () => {
  it("allows administrators", () => {
    expect(evaluateAdministratorLogin(["admin"]).ok).toBe(true);
    expect(evaluateAdministratorLogin(["super_admin"]).ok).toBe(true);
  });

  it("denies non-administrators with a message that avoids role leakage", () => {
    const result = evaluateAdministratorLogin(["support"]);
    expect(result.ok).toBe(false);
    expect(result.message).toBeTruthy();
    expect(result.message!.toLowerCase()).not.toMatch(/super_admin|public_user/);
    expect(result.message!.toLowerCase()).not.toContain("support");
    expect(result.message!.toLowerCase()).not.toContain("artist");
    expect(result.message!.toLowerCase()).not.toContain("label");
  });
});
