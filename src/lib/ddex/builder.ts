import { create } from "xmlbuilder2";
import type { XMLBuilder } from "xmlbuilder2/lib/interfaces";
import {
  AVS_NAMESPACE,
  AVS_VERSION_ID,
  ERN_NAMESPACE,
  RELEASE_PROFILE_VERSION_ID,
} from "./constants";
import type { ErnDisplayArtist, ErnMessageModel, ErnSoundRecording } from "./types";

function attrBool(v: boolean): string {
  return v ? "true" : "false";
}

function ele(
  parent: XMLBuilder,
  name: string,
  attrs?: Record<string, string | number | undefined> | string,
  text?: string
): XMLBuilder {
  if (typeof attrs === "string" && text === undefined) {
    return parent.ele(name).txt(attrs);
  }
  const clean: Record<string, string> = {};
  if (attrs && typeof attrs === "object") {
    for (const [k, v] of Object.entries(attrs)) {
      if (v !== undefined && v !== null && v !== "") clean[k] = String(v);
    }
  }
  const node = parent.ele(name, clean);
  if (text !== undefined) node.txt(text);
  return node;
}

function titleBlock(
  parent: XMLBuilder,
  tag: "DisplayTitleText" | "DisplayTitle",
  title: string,
  subtitle: string | null | undefined,
  lang: string
) {
  const attrs = {
    IsDefault: attrBool(true),
    IsInOriginalLanguage: attrBool(true),
    LanguageAndScriptCode: lang,
    ApplicableTerritoryCode: "Worldwide",
  };
  if (tag === "DisplayTitleText") {
    ele(parent, "DisplayTitleText", attrs, title);
    return;
  }
  const node = ele(parent, "DisplayTitle", attrs);
  ele(node, "TitleText", title);
  if (subtitle?.trim()) ele(node, "SubTitle", subtitle.trim());
}

function displayArtists(parent: XMLBuilder, artists: ErnDisplayArtist[]) {
  for (const a of artists) {
    const n = parent.ele("DisplayArtist", { SequenceNumber: String(a.sequence) });
    ele(n, "ArtistPartyReference", a.partyReference);
    ele(n, "DisplayArtistRole", a.role);
  }
}

function line(
  parent: XMLBuilder,
  tag: "CLine" | "PLine",
  year: number,
  text: string
) {
  const n = ele(parent, tag, {
    IsDefault: attrBool(true),
    ApplicableTerritoryCode: "Worldwide",
  });
  ele(n, "Year", String(year));
  ele(n, `${tag}Text`, text);
}

function soundRecording(parent: XMLBuilder, rec: ErnSoundRecording, lang: string) {
  const sr = parent.ele("SoundRecording");
  ele(sr, "ResourceReference", rec.resourceReference);
  ele(sr, "Type", "MusicalWorkSoundRecording");
  const edition = sr.ele("SoundRecordingEdition");
  const rid = edition.ele("ResourceId");
  ele(rid, "ISRC", rec.isrc);
  line(edition, "PLine", rec.pLineYear, rec.pLineText);
  const tech = ele(edition, "TechnicalDetails", {
    IsDefault: attrBool(true),
    ApplicableTerritoryCode: "Worldwide",
  });
  ele(tech, "TechnicalResourceDetailsReference", rec.technicalReference);
  const df = tech.ele("DeliveryFile");
  ele(df, "Type", "AudioFile");
  if (rec.container) ele(df, "ContainerFormat", rec.container);
  if (rec.codec) ele(df, "AudioCodecType", rec.codec);
  if (rec.channels != null) ele(df, "NumberOfChannels", String(rec.channels));
  if (rec.sampleRateHz != null) {
    ele(df, "SamplingRate", { UnitOfMeasure: "Hz" }, String(rec.sampleRateHz));
  }
  if (rec.bitDepth != null) ele(df, "BitsPerSample", String(rec.bitDepth));
  ele(df, "Duration", rec.durationIso);
  const file = df.ele("File");
  ele(file, "URI", rec.fileUri);
  if (rec.hashAlgorithm && rec.hashValue) {
    const hs = file.ele("HashSum");
    ele(hs, "Algorithm", rec.hashAlgorithm);
    ele(hs, "HashSumValue", rec.hashValue);
  }
  titleBlock(sr, "DisplayTitleText", rec.title, rec.subtitle, rec.languageAndScriptCode || lang);
  titleBlock(sr, "DisplayTitle", rec.title, rec.subtitle, rec.languageAndScriptCode || lang);
  ele(
    sr,
    "DisplayArtistName",
    {
      IsDefault: attrBool(true),
      IsInOriginalLanguage: attrBool(true),
      LanguageAndScriptCode: rec.languageAndScriptCode || lang,
      ApplicableTerritoryCode: "Worldwide",
    },
    rec.displayArtistName
  );
  displayArtists(sr, rec.displayArtists);
  for (const c of rec.contributors) {
    const n = sr.ele("Contributor", { SequenceNumber: String(c.sequence) });
    ele(n, "ContributorPartyReference", c.partyReference);
    const role = n.ele("Role");
    ele(role, "Value", c.role);
  }
  ele(sr, "Duration", rec.durationIso);
  ele(
    sr,
    "ParentalWarningType",
    { IsDefault: attrBool(true), ApplicableTerritoryCode: "Worldwide" },
    rec.parentalWarning
  );
}

/**
 * Build ERN 4.3.2 NewReleaseMessage XML from a mapped model.
 * Uses xmlbuilder2 — no string concatenation of user metadata.
 */
export function buildNewReleaseMessageXml(model: ErnMessageModel): string {
  if (model.header.senderPartyId.startsWith("PA-")) {
    throw new Error("MessageHeader PartyId must be compact PADPIDA form, not hyphenated DPID.");
  }
  const root = create({ version: "1.0", encoding: "UTF-8" }).ele("ern:NewReleaseMessage", {
    "xmlns:ern": ERN_NAMESPACE,
    "xmlns:avs": AVS_NAMESPACE,
    LanguageAndScriptCode: model.languageAndScriptCode,
    ReleaseProfileVersionId: RELEASE_PROFILE_VERSION_ID,
    AvsVersionId: String(AVS_VERSION_ID),
  });

  const header = root.ele("MessageHeader");
  ele(header, "MessageThreadId", model.header.messageThreadId);
  ele(header, "MessageId", model.header.messageId);
  ele(header, "MessageFileName", model.header.messageFileName);
  const sender = header.ele("MessageSender");
  ele(sender, "PartyId", model.header.senderPartyId);
  ele(sender.ele("PartyName"), "FullName", model.header.senderName);
  const recipient = header.ele("MessageRecipient");
  ele(recipient, "PartyId", model.header.recipientPartyId);
  ele(recipient.ele("PartyName"), "FullName", model.header.recipientName);
  ele(header, "MessageCreatedDateTime", model.header.createdAt);
  ele(header, "MessageControlType", model.header.messageControlType);

  const partyList = root.ele("PartyList");
  for (const p of model.parties) {
    const party = partyList.ele("Party");
    ele(party, "PartyReference", p.reference);
    const name = ele(party, "PartyName", {
      IsDefault: attrBool(true),
      ApplicableTerritoryCode: "Worldwide",
      ...(p.isLegalName ? { IsLegalName: attrBool(true) } : {}),
    });
    ele(name, "FullName", p.name);
    if (p.isni || p.ipi) {
      const pid = party.ele("PartyId");
      if (p.isni) ele(pid, "ISNI", p.isni);
      if (p.ipi) ele(pid, "IpiNameNumber", p.ipi);
    }
  }

  const resources = root.ele("ResourceList");
  for (const rec of model.soundRecordings) {
    soundRecording(resources, rec, model.languageAndScriptCode);
  }

  const img = resources.ele("Image");
  ele(img, "ResourceReference", model.image.resourceReference);
  ele(img, "Type", "FrontCoverImage");
  const imgId = img.ele("ResourceId");
  ele(
    imgId,
    "ProprietaryId",
    { Namespace: model.header.senderPartyId },
    model.image.proprietaryId
  );
  titleBlock(img, "DisplayTitleText", model.image.title, null, model.languageAndScriptCode);
  line(img, "CLine", model.image.cLineYear, model.image.cLineText);
  ele(
    img,
    "ParentalWarningType",
    { IsDefault: attrBool(true), ApplicableTerritoryCode: "Worldwide" },
    model.image.parentalWarning
  );
  const imgTech = ele(img, "TechnicalDetails", {
    IsDefault: attrBool(true),
    ApplicableTerritoryCode: "Worldwide",
  });
  ele(imgTech, "TechnicalResourceDetailsReference", model.image.technicalReference);
  if (model.image.codec) ele(imgTech, "ImageCodecType", model.image.codec);
  if (model.image.height != null) {
    ele(imgTech, "ImageHeight", { UnitOfMeasure: "Pixel" }, String(model.image.height));
  }
  if (model.image.width != null) {
    ele(imgTech, "ImageWidth", { UnitOfMeasure: "Pixel" }, String(model.image.width));
  }
  const imgFile = imgTech.ele("File");
  ele(imgFile, "URI", model.image.fileUri);
  if (model.image.hashAlgorithm && model.image.hashValue) {
    const hs = imgFile.ele("HashSum");
    ele(hs, "Algorithm", model.image.hashAlgorithm);
    ele(hs, "HashSumValue", model.image.hashValue);
  }

  const releaseList = root.ele("ReleaseList");
  const main = releaseList.ele("Release");
  const m = model.mainRelease;
  ele(main, "ReleaseReference", m.releaseReference);
  ele(main, "ReleaseType", m.releaseType);
  const mid = main.ele("ReleaseId");
  ele(mid, "ICPN", m.icpn);
  titleBlock(main, "DisplayTitleText", m.title, m.subtitle, model.languageAndScriptCode);
  titleBlock(main, "DisplayTitle", m.title, m.subtitle, model.languageAndScriptCode);
  ele(
    main,
    "DisplayArtistName",
    {
      IsDefault: attrBool(true),
      IsInOriginalLanguage: attrBool(true),
      LanguageAndScriptCode: model.languageAndScriptCode,
      ApplicableTerritoryCode: "Worldwide",
    },
    m.displayArtistName
  );
  displayArtists(main, m.displayArtists);
  ele(
    main,
    "ReleaseLabelReference",
    {
      IsDefault: attrBool(true),
      ApplicableTerritoryCode: "Worldwide",
      LabelType: "DisplayLabel",
    },
    m.labelPartyReference
  );
  line(main, "PLine", m.pLineYear, m.pLineText);
  line(main, "CLine", m.cLineYear, m.cLineText);
  ele(main, "Duration", m.durationIso);
  const genre = ele(main, "DisplayGenre", {
    IsDefault: attrBool(true),
    ApplicableTerritoryCode: "Worldwide",
  });
  ele(genre, "GenreText", m.genreText);
  if (m.subgenre?.trim()) ele(genre, "SubGenre", m.subgenre.trim());
  ele(
    main,
    "ReleaseDate",
    { IsDefault: attrBool(true), ApplicableTerritoryCode: "Worldwide" },
    m.releaseDate
  );
  if (m.originalReleaseDate) {
    ele(
      main,
      "OriginalReleaseDate",
      { IsDefault: attrBool(true), ApplicableTerritoryCode: "Worldwide" },
      m.originalReleaseDate
    );
  }
  ele(
    main,
    "ParentalWarningType",
    { IsDefault: attrBool(true), ApplicableTerritoryCode: "Worldwide" },
    m.parentalWarning
  );
  const group = main.ele("ResourceGroup");
  ele(group, "SequenceNumber", "1");
  for (const item of m.resourceGroup) {
    const ci = group.ele("ResourceGroupContentItem");
    ele(ci, "SequenceNumber", String(item.sequence));
    ele(ci, "ReleaseResourceReference", item.resourceReference);
  }
  ele(
    group,
    "LinkedReleaseResourceReference",
    { LinkDescription: "CoverArt" },
    m.coverResourceReference
  );

  for (const tr of model.trackReleases) {
    const node = releaseList.ele("TrackRelease");
    ele(node, "ReleaseReference", tr.releaseReference);
    const tid = node.ele("ReleaseId");
    ele(tid, "ProprietaryId", { Namespace: model.header.senderPartyId }, tr.proprietaryId);
    titleBlock(node, "DisplayTitleText", tr.title, tr.subtitle, model.languageAndScriptCode);
    titleBlock(node, "DisplayTitle", tr.title, tr.subtitle, model.languageAndScriptCode);
    ele(node, "ReleaseResourceReference", tr.resourceReference);
    ele(
      node,
      "LinkedReleaseResourceReference",
      { LinkDescription: "CoverArt" },
      m.coverResourceReference
    );
    ele(
      node,
      "ReleaseLabelReference",
      {
        IsDefault: attrBool(true),
        ApplicableTerritoryCode: "Worldwide",
        LabelType: "DisplayLabel",
      },
      m.labelPartyReference
    );
    const tg = ele(node, "DisplayGenre", {
      IsDefault: attrBool(true),
      ApplicableTerritoryCode: "Worldwide",
    });
    ele(tg, "GenreText", tr.genreText);
    if (tr.subgenre?.trim()) ele(tg, "SubGenre", tr.subgenre.trim());
  }

  const dealList = root.ele("DealList");
  const rd = dealList.ele("ReleaseDeal");
  for (const ref of model.deal.releaseReferences) {
    ele(rd, "DealReleaseReference", ref);
  }
  const terms = rd.ele("Deal").ele("DealTerms");
  for (const t of model.deal.territories) {
    ele(terms, "TerritoryCode", t);
  }
  const period = terms.ele("ValidityPeriod");
  ele(period, "StartDate", model.deal.startDate);
  if (model.deal.endDate) ele(period, "EndDate", model.deal.endDate);
  for (const c of model.deal.commercialModelTypes) ele(terms, "CommercialModelType", c);
  for (const u of model.deal.useTypes) ele(terms, "UseType", u);

  return root.end({ prettyPrint: true, headless: false });
}

export function assertProductionNamespaces(xml: string): void {
  if (!xml.includes(ERN_NAMESPACE)) {
    throw new Error("ERN namespace http://ddex.net/xml/ern/432 is required.");
  }
  if (xml.includes("http://ddex.net/xml/ern/431")) {
    throw new Error("ern/431 is not allowed in production output.");
  }
  if (!xml.includes(`AvsVersionId="${AVS_VERSION_ID}"`)) {
    throw new Error("AvsVersionId=9 is required.");
  }
  if (/AvsVersionId="7"/.test(xml)) {
    throw new Error("AvsVersionId=7 is not allowed in production output.");
  }
}
