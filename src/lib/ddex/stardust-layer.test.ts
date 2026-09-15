import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { applyDdexAcknowledgment } from "./acknowledgments";
import { buildNewReleaseMessageXml } from "./builder";
import { TEST_DDEX_CONFIG, singleFixture } from "./__fixtures__/catalog";
import { getNexoDdexContact, getNexoPartyName } from "./constants";
import { LOCKED_NEXO_DPID_COMPACT, LOCKED_NEXO_PARTY_NAME, assertLockedSenderForDelivery, ProductionDpidGuardError } from "./identity";
import { DdexMappingError } from "./mapping";
import {
  MAX_DELIVERY_ATTEMPTS,
  assertCanSendDelivery,
  buildDdexPackageFromGenerated,
  deliveryIdempotencyKey,
  generateDdexReleaseFromSnapshot,
  nextRetryDelayMs,
  queueStateFromExisting,
  retryAllowed,
} from "./pipeline";
import { LocalProtocolAdapter, adapterForTarget } from "./protocols";
import { COMMERCIAL_DSP_NAMES, configForTarget, isTargetRuntimeConnected, localTestTargetFixture } from "./targets";
import { validateErnXml } from "./validate";

const root = join(__dirname, "../../..");

describe("Stardust DDEX layer — identity and pipeline", () => {
  it("synthetic ERN header uses locked Nexo DPID and party name", () => {
    const generated = generateDdexReleaseFromSnapshot(singleFixture(), TEST_DDEX_CONFIG, {
      target: localTestTargetFixture(),
      messageId: "NEXOTESTSTARDUST1",
      createdAt: new Date("2026-09-15T03:00:00Z"),
    });
    expect(generated.xml).toContain(`<PartyId>${LOCKED_NEXO_DPID_COMPACT}</PartyId>`);
    expect(generated.xml).toContain("NEXO MUSIC DISTRIBUTION LTD");
    expect(generated.xml).toContain("TestMessage");
    expect(generated.messageSubType).toBe("Initial");
    expect(generated.ernVersion).toBe("4.3.2");
    const xsd = validateErnXml(generated.xml);
    expect(xsd.errors).toEqual([]);
    expect(xsd.ok).toBe(true);
  });

  it("refuses to fabricate missing ISRC / UPC", () => {
    const snap = singleFixture();
    snap.tracks[0].isrc = null;
    expect(() => generateDdexReleaseFromSnapshot(snap, TEST_DDEX_CONFIG, { target: localTestTargetFixture() })).toThrow(
      DdexMappingError
    );
    const noUpc = singleFixture();
    noUpc.release.upc = null;
    expect(() =>
      generateDdexReleaseFromSnapshot(noUpc, TEST_DDEX_CONFIG, { target: localTestTargetFixture() })
    ).toThrow(/UPC/);
  });

  it("Update keeps MessageThreadId; Takedown writes EndDate and still XSD-validates", () => {
    const initial = generateDdexReleaseFromSnapshot(singleFixture(), TEST_DDEX_CONFIG, {
      target: localTestTargetFixture(),
      messageId: "NEXOTESTINITIAL1",
      createdAt: new Date("2026-09-15T03:00:00Z"),
    });
    const update = generateDdexReleaseFromSnapshot(singleFixture(), TEST_DDEX_CONFIG, {
      target: localTestTargetFixture(),
      messageId: "NEXOTESTUPDATE1",
      messageThreadId: initial.messageId,
      messageSubType: "Update",
      createdAt: new Date("2026-09-16T03:00:00Z"),
    });
    expect(update.model.header.messageThreadId).toBe("NEXOTESTINITIAL1");
    expect(update.model.header.messageId).toBe("NEXOTESTUPDATE1");
    expect(validateErnXml(update.xml).ok).toBe(true);

    const takedown = generateDdexReleaseFromSnapshot(singleFixture(), TEST_DDEX_CONFIG, {
      target: localTestTargetFixture(),
      messageId: "NEXOTESTTAKE1",
      messageThreadId: initial.messageId,
      messageSubType: "Takedown",
      takedownDate: "2026-09-20",
      createdAt: new Date("2026-09-20T03:00:00Z"),
    });
    expect(takedown.xml).toContain("<EndDate>2026-09-20</EndDate>");
    expect(validateErnXml(takedown.xml).ok).toBe(true);
  });

  it("packages ERN with sha256 and never invents asset hashes", () => {
    const generated = generateDdexReleaseFromSnapshot(singleFixture(), TEST_DDEX_CONFIG, {
      target: localTestTargetFixture(),
      messageId: "NEXOTESTPKG1",
    });
    const pkg = buildDdexPackageFromGenerated(
      generated,
      singleFixture(),
      "rel-single",
      localTestTargetFixture()
    );
    expect(pkg.xmlSha256).toHaveLength(64);
    expect(pkg.manifest.files.some((f) => f.kind === "ern")).toBe(true);
    expect(pkg.manifest.upc).toBe("123456789012");
    const broken = singleFixture();
    broken.assets[0].checksum = null;
    expect(() =>
      buildDdexPackageFromGenerated(generated, broken, "rel-single", localTestTargetFixture())
    ).toThrow(/checksum/);
  });

  it("local test protocol writes to the sink; FTP/S3/Azure stay NOT CONNECTED without credentials", async () => {
    const generated = generateDdexReleaseFromSnapshot(singleFixture(), TEST_DDEX_CONFIG, {
      target: localTestTargetFixture(),
      messageId: "NEXOTESTLOCAL1",
    });
    const written = new Map<string, Buffer>();
    const local = new LocalProtocolAdapter(async (path, body) => {
      written.set(path, body);
    });
    const result = await local.deliver({
      manifest: {
        messageId: generated.messageId,
        messageSubType: "Initial",
        ernVersion: "4.3.2",
        releaseId: "rel-single",
        upc: "123456789012",
        targetSlug: "nexo-local-test",
        createdAt: generated.model.header.createdAt,
        xmlSha256: generated.validation.ok ? "x" : "",
        files: [],
      },
      xml: generated.xml,
      filename: generated.filename,
    });
    expect(result.delivered).toBe(true);
    expect(result.protocol).toBe("local");
    expect(written.size).toBe(2);

    const ftp = adapterForTarget({ protocol: "ftp", connected: false, isTest: false, prefix: "NEXO_DSP_SPOTIFY_" });
    await expect(
      ftp.deliver({
        manifest: {
          messageId: "x",
          messageSubType: "Initial",
          ernVersion: "4.3.2",
          releaseId: "r",
          upc: "1",
          targetSlug: "nope",
          createdAt: new Date().toISOString(),
          xmlSha256: "x",
          files: [],
        },
        xml: "<xml/>",
        filename: "x.xml",
      })
    ).rejects.toThrow(/NOT CONNECTED/);
  });

  it("production sender DPID guard blocks delivery when identity is not locked", () => {
    expect(() => assertLockedSenderForDelivery("PA-DPIDA-0000000000-X")).toThrow(ProductionDpidGuardError);
    expect(assertLockedSenderForDelivery("PA-DPIDA-2026021501-H")).toBe(LOCKED_NEXO_DPID_COMPACT);
    const commercial = localTestTargetFixture();
    commercial.is_test = false;
    commercial.commercial_approval_required = true;
    commercial.protocol = "sftp";
    commercial.is_active = false;
    expect(() =>
      assertCanSendDelivery({ senderDpid: "PA-DPIDA-2026021501-H", target: commercial })
    ).toThrow(/NOT CONNECTED|commercial/i);
  });

  it("queue idempotency and retry backoff match Stardust-style limits", () => {
    expect(queueStateFromExisting("queued")).toBe("reuse");
    expect(queueStateFromExisting("pending")).toBe("queue");
    expect(nextRetryDelayMs(0)).toBe(60_000);
    expect(nextRetryDelayMs(1)).toBe(300_000);
    expect(nextRetryDelayMs(2)).toBe(900_000);
    expect(retryAllowed(MAX_DELIVERY_ATTEMPTS)).toBe(false);
    expect(
      deliveryIdempotencyKey({
        releaseId: "r1",
        targetId: "t1",
        messageSubType: "Initial",
        xmlSha256: "abc",
      })
    ).toBe("r1:t1:Initial:abc");
  });

  it("acknowledgment processor requires delivered messages", () => {
    expect(() => applyDdexAcknowledgment({ delivery_status: "pending" }, "ack-1")).toThrow(/delivered/i);
    expect(applyDdexAcknowledgment({ delivery_status: "delivered" }, "ack-1").delivery_status).toBe("acknowledged");
  });

  it("test target loopback uses Nexo sender DPID; never a fake DSP Party Id", () => {
    const cfg = configForTarget(TEST_DDEX_CONFIG, localTestTargetFixture());
    expect(cfg.recipientPartyId).toBe(LOCKED_NEXO_DPID_COMPACT);
    expect(cfg.recipientName).toMatch(/Nexo Local Test/i);
    expect(cfg.testRecipient).toBe(true);
    expect(isTargetRuntimeConnected(localTestTargetFixture())).toBe(true);
  });

  it("compat 4.2 XML still carries Nexo PartyId and does not fabricate titles", () => {
    const generated = generateDdexReleaseFromSnapshot(singleFixture(), TEST_DDEX_CONFIG, {
      target: { ...localTestTargetFixture(), ern_version: "4.2" },
      messageId: "NEXOTEST42A",
    });
    expect(generated.ernVersion).toBe("4.2");
    expect(generated.xml).toContain("http://ddex.net/xml/ern/42");
    expect(generated.xml).toContain(LOCKED_NEXO_DPID_COMPACT);
    expect(generated.xml).toContain("Midnight Run");
    expect(generated.xml).not.toContain("Unknown Artist");
    expect(generated.xml).not.toContain("Untitled");
  });
});

describe("Stardust integration guards", () => {
  it("does not migrate Nexo to Firebase or scaffold Stardust create", () => {
    const pkg = readFileSync(join(root, "package.json"), "utf8");
    expect(pkg).not.toMatch(/firebase/i);
    expect(pkg).not.toContain("@stardust-distro/cli");
    const service = readFileSync(join(root, "src/lib/ddex/service.ts"), "utf8");
    expect(service).not.toMatch(/firebase/i);
  });

  it("does not seed fake commercial DSP targets", () => {
    const sql = readFileSync(join(root, "supabase/migrations/20260915910001_stardust_ddex_delivery.sql"), "utf8");
    expect(sql).toContain("nexo-local-test");
    for (const name of COMMERCIAL_DSP_NAMES) {
      expect(sql.toLowerCase()).not.toContain(name.toLowerCase());
    }
    expect(sql).not.toMatch(/spotify|apple music|youtube|tiktok|deezer|amazon music/i);
  });

  it("does not invent NEXO_DDEX_CONTACT and never puts DPID on NEXT_PUBLIC_", () => {
    const env = readFileSync(join(root, ".env.example"), "utf8");
    expect(env).not.toMatch(/^NEXO_DDEX_CONTACT=.+$/m);
    expect(env).not.toMatch(/NEXT_PUBLIC_[A-Z0-9_]*DPID/);
    expect(env).toContain("PA-DPIDA-2026021501-H");
    expect(getNexoDdexContact({})).toBeNull();
    expect(getNexoPartyName({ NEXO_DDEX_PARTY_NAME: "Someone Else Ltd" })).toBe(LOCKED_NEXO_PARTY_NAME);
  });

  it("existing 4.3.2 builder is still the primary generator", () => {
    const xml = buildNewReleaseMessageXml(
      generateDdexReleaseFromSnapshot(singleFixture(), TEST_DDEX_CONFIG, {
        messageId: "NEXOTESTPRIMARY1",
        target: localTestTargetFixture(),
        createdAt: new Date("2026-09-15T03:00:00Z"),
      }).model
    );
    expect(xml).toContain("http://ddex.net/xml/ern/432");
    expect(xml).toContain('AvsVersionId="9"');
  });
});
