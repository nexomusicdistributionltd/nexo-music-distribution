import { describe, expect, it } from "vitest";
import { canAccessEmailCenter } from "./access";

describe("Admin Email Center access", () => {
  it("allows administrators and denies support/artist/label/anon", () => {
    expect(canAccessEmailCenter(["admin"])).toBe(true);
    expect(canAccessEmailCenter(["super_admin"])).toBe(true);
    expect(canAccessEmailCenter(["support"])).toBe(false);
    expect(canAccessEmailCenter(["artist"])).toBe(false);
    expect(canAccessEmailCenter(["label"])).toBe(false);
    expect(canAccessEmailCenter(["public_user"])).toBe(false);
    expect(canAccessEmailCenter([])).toBe(false);
    expect(canAccessEmailCenter(null)).toBe(false);
  });
});
