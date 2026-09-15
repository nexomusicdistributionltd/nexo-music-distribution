import { create } from "xmlbuilder2";
import type { ErnMessageModel } from "./types";

/**
 * Per-target ERN 4.2 / 3.8.2 XML from the same Nexo-mapped model.
 * No Untitled / Unknown Artist / current-year fallbacks (those exist in upstream Stardust).
 * Not certified against bundled 4.3.2 XSD.
 */
export function buildCompatErnXml(model: ErnMessageModel, version: "4.2" | "3.8.2"): string {
  if (!model.header.senderPartyId) throw new Error("Compat ERN refused: sender PartyId missing.");
  if (!model.header.recipientPartyId) throw new Error("Compat ERN refused: recipient PartyId missing.");
  if (!model.mainRelease.icpn) throw new Error("Compat ERN refused: ICPN/UPC missing.");

  const ns = version === "4.2" ? "http://ddex.net/xml/ern/42" : "http://ddex.net/xml/ern/382";
  const schemaId = version === "4.2" ? "ern/42" : "ern/382";
  const profile =
    version === "4.2"
      ? model.soundRecordings.length > 1
        ? "CommonReleaseAudioAlbum/14"
        : "CommonReleaseAudioSingle/14"
      : model.soundRecordings.length > 1
        ? "CommonReleaseAudioAlbum/13"
        : "CommonReleaseAudioSingle/13";

  const root = create({ version: "1.0", encoding: "UTF-8" }).ele("ern:NewReleaseMessage", {
    "xmlns:ern": ns,
    MessageSchemaVersionId: schemaId,
    ReleaseProfileVersionId: profile,
    LanguageAndScriptCode: model.languageAndScriptCode,
  });

  const header = root.ele("MessageHeader");
  if (version === "3.8.2") header.ele("MessageThreadId").txt(model.header.messageThreadId);
  header.ele("MessageId").txt(model.header.messageId);
  header.ele("MessageCreatedDateTime").txt(model.header.createdAt);
  header.ele("MessageControlType").txt(model.header.messageControlType);
  const sender = header.ele("MessageSender");
  sender.ele("PartyId").txt(model.header.senderPartyId);
  sender.ele("PartyName").ele("FullName").txt(model.header.senderName);
  const recipient = header.ele("MessageRecipient");
  recipient.ele("PartyId").txt(model.header.recipientPartyId);
  recipient.ele("PartyName").ele("FullName").txt(model.header.recipientName);

  const resources = root.ele("ResourceList");
  for (const rec of model.soundRecordings) {
    const sr = resources.ele("SoundRecording");
    sr.ele("SoundRecordingId").ele("ISRC").txt(rec.isrc);
    sr.ele("ResourceReference").txt(rec.resourceReference);
    sr.ele("ReferenceTitle").ele("TitleText").txt(rec.title);
    sr.ele("Duration").txt(rec.durationIso);
    const details = sr.ele("SoundRecordingDetailsByTerritory");
    details.ele("TerritoryCode").txt("Worldwide");
    details.ele("Title").ele("TitleText").txt(rec.title);
    details.ele("DisplayArtist").ele("PartyName").ele("FullName").txt(rec.displayArtistName);
    const file = details.ele("TechnicalSoundRecordingDetails").ele("File");
    file.ele("FileName").txt(rec.fileUri);
    if (rec.hashValue) {
      const hs = file.ele("HashSum");
      hs.ele("HashSumAlgorithmType").txt(rec.hashAlgorithm || "SHA256");
      hs.ele("HashSum").txt(rec.hashValue);
    }
  }

  const img = resources.ele("Image");
  img.ele("ResourceReference").txt(model.image.resourceReference);
  const imgDetails = img.ele("ImageDetailsByTerritory");
  imgDetails.ele("TerritoryCode").txt("Worldwide");
  const imgFile = imgDetails.ele("TechnicalImageDetails").ele("File");
  imgFile.ele("FileName").txt(model.image.fileUri);
  if (model.image.hashValue) {
    const hs = imgFile.ele("HashSum");
    hs.ele("HashSumAlgorithmType").txt(model.image.hashAlgorithm || "SHA256");
    hs.ele("HashSum").txt(model.image.hashValue);
  }

  const release = root.ele("ReleaseList").ele("Release");
  release.ele("ReleaseId").ele("ICPN", { IsEan: "false" }).txt(model.mainRelease.icpn);
  release.ele("ReleaseReference").txt(model.mainRelease.releaseReference);
  release.ele("ReferenceTitle").ele("TitleText").txt(model.mainRelease.title);
  release.ele("ReleaseType").txt(model.mainRelease.releaseType);

  const dealTerms = root.ele("DealList").ele("ReleaseDeal").ele("Deal").ele("DealTerms");
  for (const t of model.deal.territories) dealTerms.ele("TerritoryCode").txt(t);
  const period = dealTerms.ele("ValidityPeriod");
  period.ele("StartDate").txt(model.deal.startDate);
  if (model.deal.endDate) period.ele("EndDate").txt(model.deal.endDate);

  return root.end({ prettyPrint: true });
}
