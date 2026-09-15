import { describe, expect, it } from "vitest";
import { AVS_NAMESPACE, AVS_VERSION_ID, ERN_NAMESPACE, ERN_VERSION, getNexoDpid } from "./constants";
import { parentalWarningFromExplicit } from "./parental-warning";
import { mapGenreToAvsStub, normalizeGenre } from "./genre-map";
import { evaluateReleaseReadiness } from "./readiness";
import { applyUpcPreserveGuard, preserveExistingIsrc, preserveExistingUpc } from "@/lib/releases/identifiers";
import { pickReleaseUpdateFields } from "@/lib/releases/safe-update";
import { navForRoles } from "@/lib/auth/nav";
import { sha256Hex } from "@/lib/releases/tech-meta";

describe("roles / DDEX foundation", () => {
  it("label nav has roster", () => {
    expect(navForRoles(["label"]).map((n) => n.href)).toContain("/app/artists");
    expect(navForRoles(["artist"]).map((n) => n.href)).not.toContain("/app/artists");
  });
  it("ERN constants", () => {
    expect(ERN_VERSION).toBe("4.3.2");
    expect(ERN_NAMESPACE).toBe("http://ddex.net/xml/ern/432");
    expect(AVS_NAMESPACE).toBe("http://ddex.net/xml/avs");
    expect(AVS_VERSION_ID).toBe(9);
  });
  it("NEXO_DPID server-only", () => {
    const prev = process.env.NEXO_DPID;
    delete process.env.NEXO_DPID;
    expect(getNexoDpid()).toBeNull();
    process.env.NEXO_DPID = "X";
    expect(getNexoDpid()).toBe("X");
    if (prev === undefined) delete process.env.NEXO_DPID; else process.env.NEXO_DPID = prev;
  });
  it("parental + genre", () => {
    expect(parentalWarningFromExplicit(true)).toBe("Explicit");
    expect(parentalWarningFromExplicit(false)).toBe("NotExplicit");
    expect(normalizeGenre("hip hop")).toBe("Hip Hop");
    expect(mapGenreToAvsStub("zzz")).toBeNull();
  });
  it("ISRC/UPC preserve", () => {
    expect(preserveExistingUpc("123456789012", "9")).toBe("123456789012");
    expect(preserveExistingIsrc("USRC17607839", "GBUM71505078")).toBe("USRC17607839");
    const safe = pickReleaseUpdateFields({ title: "T", upc: "999999999999", status: "approved" });
    expect(applyUpcPreserveGuard(safe, "123456789012")).not.toHaveProperty("upc");
  });
  it("readiness nexo vs dsp", () => {
    const missing = evaluateReleaseReadiness({
      upc: null, copyright_line: "c", phonogram_line: "p", artist_profile_id: "a",
      territories: ["WW"], tracks: [{ id: "t", isrc: null }], contributors: [{ name: "A" }],
      assets: [{ kind: "artwork", width: 3000, height: 3000 }, { kind: "audio", duration_ms: 1, sample_rate_hz: 44100, checksum: "x" }],
      deals: [{ territories: ["WW"] }],
    });
    expect(missing.nexoStatus).toBe("READY");
    expect(missing.dspStatus).toBe("MISSING");
    const ready = evaluateReleaseReadiness({
      upc: "123456789012", copyright_line: "c", phonogram_line: "p", artist_profile_id: "a",
      territories: ["WW"], tracks: [{ id: "t", isrc: "USRC17607839" }], contributors: [{ name: "A" }],
      assets: [{ kind: "artwork", width: 3000, height: 3000 }, { kind: "audio", duration_ms: 1, sample_rate_hz: 44100, checksum: "x" }],
      deals: [{ territories: ["WW"] }],
    });
    expect(ready.dspStatus).toBe("READY");
    expect(sha256Hex(Buffer.from("nexo"))).toHaveLength(64);
  });
});
