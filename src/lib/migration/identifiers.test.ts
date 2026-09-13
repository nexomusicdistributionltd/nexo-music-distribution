import { describe, expect, it } from "vitest";
import {
  isValidIsrc,
  isValidUpc,
  normalizeIsrc,
  normalizeUpc,
  preserveIdentifiers,
} from "./identifiers";

describe("ISRC/UPC preservation", () => {
  it("normalizes and validates ISRC", () => {
    expect(normalizeIsrc("us-rc1-23-00001")).toBe("USRC12300001");
    expect(isValidIsrc("USRC12300001")).toBe(true);
    expect(isValidIsrc("bad")).toBe(false);
  });

  it("normalizes and validates UPC", () => {
    expect(normalizeUpc("0 6025 478 112-3")).toBe("060254781123");
    expect(isValidUpc("060254781123")).toBe(true);
    expect(isValidUpc("123")).toBe(false);
  });

  it("preserves external identifiers without inventing", () => {
    const r = preserveIdentifiers({
      externalIsrc: "USRC12300001",
      externalUpc: "060254781123",
    });
    expect(r.isrcPreserved).toBe(true);
    expect(r.upcPreserved).toBe(true);
    expect(r.isrc).toBe("USRC12300001");
    expect(r.upc).toBe("060254781123");
  });

  it("keeps existing on conflict and warns", () => {
    const r = preserveIdentifiers({
      externalIsrc: "USRC12300002",
      existingIsrc: "USRC12300001",
    });
    expect(r.isrc).toBe("USRC12300001");
    expect(r.isrcPreserved).toBe(false);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("does not invent identifiers when empty", () => {
    const r = preserveIdentifiers({});
    expect(r.isrc).toBeNull();
    expect(r.upc).toBeNull();
    expect(r.isrcPreserved).toBe(false);
  });
});
