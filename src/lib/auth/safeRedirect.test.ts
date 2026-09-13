import { describe, expect, it } from "vitest";
import { isSafeRedirectPath, safeRedirectPath } from "./safeRedirect";

describe("isSafeRedirectPath", () => {
  it("allows relative same-origin paths", () => {
    expect(isSafeRedirectPath("/dashboard")).toBe(true);
    expect(isSafeRedirectPath("/admin/users")).toBe(true);
    expect(isSafeRedirectPath("/profile?tab=security")).toBe(true);
    expect(isSafeRedirectPath("/releases#top")).toBe(true);
  });

  it("rejects empty / missing values", () => {
    expect(isSafeRedirectPath(null)).toBe(false);
    expect(isSafeRedirectPath(undefined)).toBe(false);
    expect(isSafeRedirectPath("")).toBe(false);
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(isSafeRedirectPath("https://evil.example")).toBe(false);
    expect(isSafeRedirectPath("http://evil.example/phish")).toBe(false);
    expect(isSafeRedirectPath("//evil.example")).toBe(false);
    expect(isSafeRedirectPath("///evil.example")).toBe(false);
    expect(isSafeRedirectPath("javascript:alert(1)")).toBe(false);
  });

  it("rejects backslashes and encoded tricks", () => {
    expect(isSafeRedirectPath("/\\evil.example")).toBe(false);
    expect(isSafeRedirectPath("/%2f%2fevil.example")).toBe(false);
    expect(isSafeRedirectPath("/%2F%2Fevil.example")).toBe(false);
    expect(isSafeRedirectPath("/%5cevil.example")).toBe(false);
    expect(isSafeRedirectPath("/%252f%252fevil.example")).toBe(false);
  });

  it("rejects newlines and other control characters", () => {
    expect(isSafeRedirectPath("/dashboard\nLocation: https://evil.example")).toBe(false);
    expect(isSafeRedirectPath("/dashboard\r\n")).toBe(false);
    expect(isSafeRedirectPath("/%0d%0aLocation:%20https://evil.example")).toBe(false);
    expect(isSafeRedirectPath("/dash\tboard")).toBe(false);
  });
});

describe("safeRedirectPath", () => {
  it("returns the candidate when safe", () => {
    expect(safeRedirectPath("/earnings")).toBe("/earnings");
  });

  it("defaults to /dashboard when invalid and no roles", () => {
    expect(safeRedirectPath("//evil.example")).toBe("/dashboard");
    expect(safeRedirectPath("https://evil.example")).toBe("/dashboard");
    expect(safeRedirectPath(null)).toBe("/dashboard");
  });

  it("defaults to homePathForRoles when roles are provided", () => {
    expect(safeRedirectPath("//evil.example", ["admin"])).toBe("/admin");
    expect(safeRedirectPath("https://evil.example", ["support"])).toBe("/admin");
    expect(safeRedirectPath(null, ["artist"])).toBe("/dashboard");
    expect(safeRedirectPath("nope-not-relative", ["label"])).toBe("/dashboard");
  });

  it("honors an explicit fallback", () => {
    expect(safeRedirectPath("//x", [], "/profile")).toBe("/profile");
  });
});
