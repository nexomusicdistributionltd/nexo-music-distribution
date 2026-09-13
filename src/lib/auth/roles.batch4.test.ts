import { describe, expect, it } from "vitest";
import { hasPermission } from "@/architecture/auth/rbac";
import { homePathForRoles } from "@/lib/auth/types";
import { navForRoles } from "@/lib/auth/nav";

describe("Batch 4 roles / authz", () => {
  it("artists and labels can write catalog and submit", () => {
    expect(hasPermission(["artist"], "catalog:write")).toBe(true);
    expect(hasPermission(["label"], "release:submit")).toBe(true);
    expect(hasPermission(["public_user"], "catalog:write")).toBe(false);
  });

  it("routes home by role", () => {
    expect(homePathForRoles(["artist"])).toBe("/dashboard");
    expect(homePathForRoles(["admin"])).toBe("/admin");
    expect(homePathForRoles(["support"])).toBe("/admin");
    expect(homePathForRoles(["public_user"])).toBe("/profile");
  });

  it("nav includes Batch 4 destinations for artists", () => {
    const hrefs = navForRoles(["artist"]).map((n) => n.href);
    expect(hrefs).toContain("/dashboard/releases");
    expect(hrefs).toContain("/dashboard/catalog");
    expect(hrefs).toContain("/dashboard/notifications");
    expect(hrefs).toContain("/dashboard/settings");
  });
});
