import { describe, expect, it } from "vitest";
import { buildNewReleaseMessageXml } from "./builder";
import {
  AVS_NAMESPACE,
  AVS_VERSION_ID,
  ERN_NAMESPACE,
  ERN_VERSION,
  RELEASE_PROFILE_VERSION_ID,
} from "./constants";
import { compactDpid } from "./dpid";
import { ern432Filename } from "./filename";
import { mapCatalogToErn, DdexMappingError } from "./mapping";
import { evaluateReleaseReadiness } from "./readiness";
import { getDdexTransport, NotConnectedDdexTransport } from "./transport";
import { validateErnXml } from "./validate";
import {
  TEST_DDEX_CONFIG,
  albumFixture,
  epFixture,
  singleFixture,
  unicodeSpecialCharsFixture,
} from "./__fixtures__/catalog";

const CREATED = new Date("2026-09-15T03:00:00Z");

function xmlFor(
  snapshot: ReturnType<typeof singleFixture>,
  messageId = "NEXOTESTMSG1"
) {
  const model = mapCatalogToErn(snapshot, TEST_DDEX_CONFIG, {
    messageId,
    createdAt: CREATED,
  });
  return { model, xml: buildNewReleaseMessageXml(model) };
}

describe("ERN 4.3.2 production NewReleaseMessage", () => {
  it("constants are 4.3.2 / ern/432 / AVS allowed-value-sets / AvsVersionId 9 / Audio", () => {
    expect(ERN_VERSION).toBe("4.3.2");
    expect(ERN_NAMESPACE).toBe("http://ddex.net/xml/ern/432");
    expect(AVS_NAMESPACE).toBe("http://ddex.net/xml/allowed-value-sets");
    expect(AVS_VERSION_ID).toBe(9);
    expect(RELEASE_PROFILE_VERSION_ID).toBe("Audio");
  });

  it("compacts hyphenated DPID for MessageHeader PartyId", () => {
    expect(compactDpid("PA-DPIDA-2026021501-H")).toBe("PADPIDA2026021501H");
    expect(compactDpid("not-a-dpid")).toBeNull();
  });

  it("golden Audio Single passes official XSD (not mocked)", () => {
    const { xml, model } = xmlFor(singleFixture(), "NEXOTESTSINGLE1");
    expect(xml).toContain(ERN_NAMESPACE);
    expect(xml).toContain(AVS_NAMESPACE);
    expect(xml).toContain('AvsVersionId="9"');
    expect(xml).toContain('ReleaseProfileVersionId="Audio"');
    expect(xml).not.toContain("http://ddex.net/xml/ern/431");
    expect(xml).not.toContain('AvsVersionId="7"');
    expect(xml).not.toContain("PurgeReleaseMessage");
    expect(xml).toContain("<PartyId>PADPIDA2026021501H</PartyId>");
    expect(xml).toContain("<ISRC>USRC17607839</ISRC>");
    expect(xml).toContain("<ICPN>123456789012</ICPN>");
    expect(xml).toContain("FrontCoverImage");
    expect(xml).toContain("<ReleaseType>Single</ReleaseType>");
    expect(xml).not.toContain("share_percent");
    expect(xml).toContain("FeaturedArtist");
    expect(xml).toContain("StudioProducer");
    expect(xml).toContain("resources/audio/");
    expect(xml).not.toContain("https://");
    expect(model.header.messageFileName).toBe(
      ern432Filename("Midnight Run", "NEXOTESTSINGLE1")
    );
    const result = validateErnXml(xml);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("golden multi-track EP passes official XSD (not mocked)", () => {
    const { xml } = xmlFor(epFixture(), "NEXOTESTEP1");
    expect(xml).toContain("<ReleaseType>EP</ReleaseType>");
    expect(xml).toContain("<SequenceNumber>2</SequenceNumber>");
    expect(xml).toContain("<ISRC>USRC17607840</ISRC>");
    const result = validateErnXml(xml);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("golden multi-track album passes official XSD (not mocked)", () => {
    const { xml } = xmlFor(albumFixture(), "NEXOTESTALBUM1");
    expect(xml).toContain("<ReleaseType>Album</ReleaseType>");
    expect(xml).toContain(">Explicit</ParentalWarningType>");
    expect(xml).toContain("<ISRC>GBUM71505078</ISRC>");
    const result = validateErnXml(xml);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("explicit vs clean parental warning", () => {
    const clean = xmlFor(singleFixture()).xml;
    expect(clean).toContain("NotExplicit");
    const expl = singleFixture();
    expl.release.explicit = true;
    expl.tracks[0].explicit = true;
    expect(xmlFor(expl, "NEXOTESTEXPL1").xml).toContain("Explicit");
  });

  it("missing ISRC is a mapping ERROR and readiness ERROR", () => {
    const snap = singleFixture();
    snap.tracks[0].isrc = null;
    expect(() => mapCatalogToErn(snap, TEST_DDEX_CONFIG)).toThrow(DdexMappingError);
    const ready = evaluateReleaseReadiness({
      ...snap.release,
      tracks: snap.tracks,
      contributors: snap.contributors,
      assets: snap.assets,
      deals: snap.deals,
    });
    expect(ready.items.find((i) => i.key === "isrc")?.status).toBe("ERROR");
    expect(ready.canGenerate).toBe(false);
  });

  it("missing UPC is a mapping ERROR", () => {
    const snap = singleFixture();
    snap.release.upc = null;
    expect(() => mapCatalogToErn(snap, TEST_DDEX_CONFIG)).toThrow(/UPC/);
  });

  it("featured and track contributors map without using share_percent as DisplayArtist %", () => {
    const { xml } = xmlFor(singleFixture(), "NEXOTESTFEAT1");
    expect(xml).toContain("DJ Koda");
    expect(xml).toContain("FeaturedArtist");
    expect(xml).toContain("Sam Producer");
    expect(xml).not.toContain("share_percent");
    expect(xml).not.toContain("<Percentage>");
  });

  it("valid WW territory maps to Worldwide; invalid territory fails", () => {
    const ok = xmlFor(singleFixture(), "NEXOTESTWW1").xml;
    expect(ok).toContain("<TerritoryCode>Worldwide</TerritoryCode>");
    const bad = singleFixture();
    bad.deals = [{ ...bad.deals[0], territories: ["ZZZ"] }];
    expect(() => mapCatalogToErn(bad, TEST_DDEX_CONFIG)).toThrow(/Invalid territories/);
    const ready = evaluateReleaseReadiness({
      ...bad.release,
      tracks: bad.tracks,
      contributors: bad.contributors,
      assets: bad.assets,
      deals: bad.deals,
    });
    expect(ready.items.find((i) => i.key === "deal_territories")?.status).toBe("ERROR");
  });

  it("missing artwork, audio, C/P lines fail mapping", () => {
    const noArt = singleFixture();
    noArt.assets = noArt.assets.filter((a) => a.kind !== "artwork");
    expect(() => mapCatalogToErn(noArt, TEST_DDEX_CONFIG)).toThrow(/artwork/i);

    const noAudio = singleFixture();
    noAudio.assets = noAudio.assets.filter((a) => a.kind !== "audio");
    expect(() => mapCatalogToErn(noAudio, TEST_DDEX_CONFIG)).toThrow(/audio/i);

    const noC = singleFixture();
    noC.release.copyright_line = "";
    expect(() => mapCatalogToErn(noC, TEST_DDEX_CONFIG)).toThrow(/Copyright/);

    const noP = singleFixture();
    noP.release.phonogram_line = "";
    expect(() => mapCatalogToErn(noP, TEST_DDEX_CONFIG)).toThrow(/Phonogram/);
  });

  it("bad deals fail readiness and mapping", () => {
    const snap = singleFixture();
    snap.release.release_date = null;
    snap.deals = [
      {
        territories: ["US"],
        use_types: [],
        commercial_model_types: ["NotAModel"],
        validity_start: null,
      },
    ];
    expect(() => mapCatalogToErn(snap, TEST_DDEX_CONFIG)).toThrow(DdexMappingError);
    const ready = evaluateReleaseReadiness({
      ...snap.release,
      tracks: snap.tracks,
      contributors: snap.contributors,
      assets: snap.assets,
      deals: snap.deals,
    });
    expect(ready.canGenerate).toBe(false);
    expect(ready.items.find((i) => i.key === "deal_use_types")?.status).toBe("MISSING");
    expect(ready.items.find((i) => i.key === "deal_commercial_models")?.status).toBe("ERROR");
    expect(ready.items.find((i) => i.key === "deal_validity")?.status).toBe("MISSING");
  });

  it("XML special characters and Unicode pass official XSD", () => {
    const { xml } = xmlFor(unicodeSpecialCharsFixture(), "NEXOTESTUNI1");
    expect(xml).toContain("Café");
    expect(xml).toContain("日本語");
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&lt;");
    expect(xml).toContain("&gt;");
    const result = validateErnXml(xml);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("filename follows NEXO_<release>_<message>_ERN432.xml", () => {
    expect(ern432Filename("Midnight Run", "NEXOTESTMSG1")).toBe(
      "NEXO_Midnight_Run_NEXOTESTMSG1_ERN432.xml"
    );
  });

  it("transport adapter is a stub and is not connected", async () => {
    const t = getDdexTransport();
    expect(t).toBeInstanceOf(NotConnectedDdexTransport);
    expect(t.connected).toBe(false);
    await expect(
      t.deliver({ messageId: "x", filename: "x.xml", xml: "<xml/>", recipientConfigKey: "test" })
    ).rejects.toThrow(/not connected/i);
  });

  it("rejects ern/431 documents at the XSD gate", () => {
    const fake = `<?xml version="1.0"?><ern:NewReleaseMessage xmlns:ern="http://ddex.net/xml/ern/431" AvsVersionId="7"></ern:NewReleaseMessage>`;
    const result = validateErnXml(fake);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/431|AvsVersionId/);
  });

  it("does not generate without configured recipient", () => {
    const cfg = { ...TEST_DDEX_CONFIG, recipientPartyId: null, recipientDpidDisplay: null };
    expect(() => mapCatalogToErn(singleFixture(), cfg)).toThrow(/Recipient DPID/);
  });
});
