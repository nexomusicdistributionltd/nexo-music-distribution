import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { AVS_NAMESPACE, AVS_VERSION_ID, ERN_NAMESPACE, ERN_VERSION, getNexoDpid } from "./constants";
import { parentalWarningFromExplicit } from "./parental-warning";
import { mapGenreToAvsStub, normalizeGenre } from "./genre-map";
import { evaluateReleaseReadiness } from "./readiness";
import { applyUpcPreserveGuard, preserveExistingIsrc, preserveExistingUpc } from "@/lib/releases/identifiers";
import { pickReleaseUpdateFields } from "@/lib/releases/safe-update";
import { navForRoles } from "@/lib/auth/nav";
import { sha256Hex } from "@/lib/releases/tech-meta";

const root = join(__dirname, "../../..");

describe("roles / DDEX foundation", () => {
  it("label nav has roster", () => {
    expect(navForRoles(["label"]).map((n) => n.href)).toContain("/app/artists");
    expect(navForRoles(["artist"]).map((n) => n.href)).not.toContain("/app/artists");
  });
  it("ERN constants", () => {
    expect(ERN_VERSION).toBe("4.3.2");
    expect(ERN_NAMESPACE).toBe("http://ddex.net/xml/ern/432");
    expect(AVS_NAMESPACE).toBe("http://ddex.net/xml/allowed-value-sets");
    expect(AVS_VERSION_ID).toBe(9);
  });
  it("NEXO_DPID server-only", () => {
    const prev = process.env.NEXO_DPID;
    const prevAlias = process.env.NEXO_DDEX_DPID;
    delete process.env.NEXO_DPID;
    delete process.env.NEXO_DDEX_DPID;
    expect(getNexoDpid()).toBeNull();
    process.env.NEXO_DPID = "X";
    expect(getNexoDpid()).toBe("X");
    if (prev === undefined) delete process.env.NEXO_DPID; else process.env.NEXO_DPID = prev;
    if (prevAlias === undefined) delete process.env.NEXO_DDEX_DPID; else process.env.NEXO_DDEX_DPID = prevAlias;
  });
  it("env example never exposes DPID to the client; recipient stays unset", () => {
    const env = readFileSync(join(root, ".env.example"), "utf8");
    expect(env).not.toMatch(/NEXT_PUBLIC_[A-Z0-9_]*DPID/);
    expect(env).toContain("NEXO_DPID=PA-DPIDA-YYYYMMDDNN-X");
    expect(env).toContain("NEXO_DDEX_DPID=PA-DPIDA-YYYYMMDDNN-X");
    expect(env).toContain("PA-DPIDA-2026021501-H");
    expect(env).toMatch(/NEXO_DDEX_RECIPIENT_DPID=\s*$/m);
    expect(env).toContain("NO authorized DSP recipient DPID");
    expect(env).toContain("NEXO_DDEX_CONTACT is NOT configured");
    expect(env).not.toMatch(/^NEXO_DDEX_CONTACT=.+$/m);
    const cfgSrc = readFileSync(join(root, "src/lib/ddex/config.ts"), "utf8");
    expect(cfgSrc).toContain("import \"server-only\"");
    expect(cfgSrc).toContain("never includes DPID values");
    expect(cfgSrc).toContain("senderConfigured: Boolean(cfg.senderPartyId)");
    expect(cfgSrc).toContain("recipientConfigured: Boolean(cfg.recipientPartyId)");
    expect(cfgSrc).not.toMatch(/ddexConfigPublicStatus[\s\S]*senderDpidDisplay/);
    expect(cfgSrc).not.toMatch(/ddexConfigPublicStatus[\s\S]*recipientDpidDisplay/);
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
      genre: "pop",
      territories: ["WW"], tracks: [{ id: "t", isrc: null }], contributors: [{ name: "A" }],
      assets: [{ kind: "artwork", width: 3000, height: 3000 }, { kind: "audio", duration_ms: 1, sample_rate_hz: 44100, checksum: "x" }],
      deals: [{ territories: ["WW"], use_types: ["OnDemandStream"], commercial_model_types: ["SubscriptionModel"], validity_start: "2026-09-15" }],
    });
    expect(missing.nexoStatus).toBe("READY");
    expect(missing.dspStatus).toBe("ERROR");
    const ready = evaluateReleaseReadiness({
      upc: "123456789012", copyright_line: "c", phonogram_line: "p", artist_profile_id: "a",
      genre: "pop",
      territories: ["WW"], tracks: [{ id: "t", isrc: "USRC17607839" }], contributors: [{ name: "A" }],
      assets: [{ kind: "artwork", width: 3000, height: 3000 }, { kind: "audio", duration_ms: 1, sample_rate_hz: 44100, checksum: "x" }],
      deals: [{ territories: ["WW"], use_types: ["OnDemandStream"], commercial_model_types: ["SubscriptionModel"], validity_start: "2026-09-15" }],
    });
    expect(ready.dspStatus).toBe("READY");
    expect(ready.canGenerate).toBe(true);
    expect(sha256Hex(Buffer.from("nexo"))).toHaveLength(64);
  });
});
