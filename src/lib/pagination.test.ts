import { describe, expect, it } from "vitest";
import { normalizePageNumber, normalizePageSize } from "./pagination";

describe("pagination normalization", () => {
  it("keeps valid positive integer pages", () => {
    expect(normalizePageNumber("3")).toBe(3);
    expect(normalizePageNumber(7)).toBe(7);
  });

  it("rejects invalid, negative, zero and non-finite page values", () => {
    expect(normalizePageNumber("NaN")).toBe(1);
    expect(normalizePageNumber("Infinity")).toBe(1);
    expect(normalizePageNumber("-2")).toBe(1);
    expect(normalizePageNumber("0")).toBe(1);
    expect(normalizePageNumber(undefined)).toBe(1);
  });

  it("floors decimal pages and clamps page sizes", () => {
    expect(normalizePageNumber("2.9")).toBe(2);
    expect(normalizePageSize(500, 20, 50)).toBe(50);
    expect(normalizePageSize(Number.NaN, 20, 50)).toBe(20);
  });
});
