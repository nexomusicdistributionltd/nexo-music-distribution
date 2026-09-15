import { describe, expect, it } from "vitest";
import { canAccessEmailCenter } from "./access";

describe("unauthorized API mapping", () => {
  it("maps missing session to 401 and artist/label to 403", () => {
    const statusFor = (roles: string[] | null) => {
      if (!roles) return 401;
      return canAccessEmailCenter(roles as never) ? 200 : 403;
    };
    expect(statusFor(null)).toBe(401);
    expect(statusFor(["artist"])).toBe(403);
    expect(statusFor(["label"])).toBe(403);
    expect(statusFor(["admin"])).toBe(200);
    expect(statusFor(["support"])).toBe(200);
  });
});
