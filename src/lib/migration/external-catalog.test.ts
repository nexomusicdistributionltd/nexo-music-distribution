import { afterEach, describe, expect, it } from "vitest";
import {
  defaultUnavailableCatalog,
  discoverExternalCatalog,
  isExternalCatalogSourceConfigured,
} from "./external-catalog";

describe("external catalog discovery", () => {
  afterEach(() => {
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;
  });

  it("returns unavailable by default without inventing items", async () => {
    const r = defaultUnavailableCatalog();
    expect(r.available).toBe(false);
    expect(r.items).toEqual([]);
  });

  it("spotify unavailable when credentials missing", async () => {
    expect(isExternalCatalogSourceConfigured("spotify")).toBe(false);
    const r = await discoverExternalCatalog({ source: "spotify" });
    expect(r.available).toBe(false);
    expect(r.items).toEqual([]);
    if (r.available) throw new Error("Expected unavailable catalog");
    expect(r.reason).toMatch(/not connected/i);
  });

  it("still unavailable when credentials set but no adapter registered", async () => {
    process.env.SPOTIFY_CLIENT_ID = "x";
    process.env.SPOTIFY_CLIENT_SECRET = "y";
    expect(isExternalCatalogSourceConfigured("spotify")).toBe(true);
    const r = await discoverExternalCatalog({ source: "spotify" });
    expect(r.available).toBe(false);
    expect(r.items).toEqual([]);
  });
});
