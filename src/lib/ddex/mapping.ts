import { randomUUID } from "node:crypto";
import type { DdexRuntimeConfig } from "./config";
import { NEXO_SENDER_NAME } from "./constants";
import { msToIsoDuration, sumDurationsIso } from "./duration";
import { ern432Filename, isPublicOrRemoteUrl, privateResourceUri } from "./filename";
import { mapGenreToAvs } from "./genre-map";
import {
  mapAudioCodec,
  mapContainerFormat,
  mapHashAlgorithm,
  mapImageCodec,
  mapLanguageToCode,
  mapReleaseTypeToAvs,
  parseLineYear,
  isAllowedCommercialModel,
  isAllowedUseType,
} from "./avs-maps";
import { parentalWarningFromExplicit } from "./parental-warning";
import { partyKey, ReferenceAllocator } from "./references";
import { ignoreSharePercent, mapContributorRole } from "./roles";
import { validateTerritories } from "./territories";
import type {
  DdexAssetInput,
  DdexCatalogSnapshot,
  ErnContributor,
  ErnDisplayArtist,
  ErnMessageModel,
  ErnParty,
} from "./types";

export class DdexMappingError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join(" "));
    this.name = "DdexMappingError";
  }
}

export function newMessageId(): string {
  return `NEXO${randomUUID().replace(/-/g, "").toUpperCase()}`;
}

function displayArtistName(primary: string, featured: string[]): string {
  if (featured.length === 0) return primary;
  return `${primary} feat. ${featured.join(", ")}`;
}

function pickAudioAsset(assets: DdexAssetInput[], trackId: string): DdexAssetInput | undefined {
  return (
    assets.find((a) => a.kind === "audio" && a.track_id === trackId) ??
    assets.find((a) => a.kind === "audio" && !a.track_id)
  );
}

function pickArtwork(assets: DdexAssetInput[]): DdexAssetInput | undefined {
  return assets.find((a) => a.kind === "artwork");
}

export function mapCatalogToErn(
  snapshot: DdexCatalogSnapshot,
  cfg: DdexRuntimeConfig,
  options?: { messageId?: string; createdAt?: Date }
): ErnMessageModel {
  const errors: string[] = [];
  const { release, tracks, contributors, assets, deals } = snapshot;

  if (!cfg.senderPartyId) errors.push("Sender DPID is not configured.");
  if (!cfg.recipientPartyId) errors.push("Recipient DPID is not configured.");

  const releaseType = mapReleaseTypeToAvs(release.release_type);
  if (!releaseType) errors.push("Release type must be single, EP, or album.");

  const upc = release.upc?.trim() || "";
  if (!upc) errors.push("UPC / ICPN is required and is never fabricated.");

  const genreText = mapGenreToAvs(release.genre);
  if (!genreText) errors.push("Genre is missing or not mapped to a DDEX genre.");

  const lang = mapLanguageToCode(release.language);
  const refs = new ReferenceAllocator();
  const parties: ErnParty[] = [];

  const primaryName =
    snapshot.artistName?.trim() || release.primary_artist_name.trim();
  if (!primaryName) errors.push("Primary artist name is required.");
  if (!release.artist_profile_id) {
    errors.push("artist_profile_id is required (labels must select a roster artist).");
  }

  const primaryRef = refs.party(partyKey("artist", primaryName || "unknown"));
  parties.push({ reference: primaryRef, name: primaryName || "Unknown" });

  const labelName =
    snapshot.labelName?.trim() ||
    release.label_name?.trim() ||
    cfg.senderName ||
    NEXO_SENDER_NAME;
  const labelRef = refs.party(partyKey("label", labelName));
  parties.push({ reference: labelRef, name: labelName, isLegalName: true });

  const featuredNames: string[] = [];
  const releaseDisplayArtists: ErnDisplayArtist[] = [
    { partyReference: primaryRef, role: "MainArtist", sequence: 1 },
  ];

  const ensureParty = (name: string, extra?: { isni?: string | null; ipi?: string | null }) => {
    const key = partyKey("person", name);
    const reference = refs.party(key);
    if (!parties.some((p) => p.reference === reference)) {
      parties.push({
        reference,
        name,
        isni: extra?.isni?.replace(/\s/g, "").length === 16 ? extra.isni.replace(/\s/g, "") : null,
        ipi: extra?.ipi && /^\d{11}$/.test(extra.ipi.replace(/\D/g, "")) ? extra.ipi.replace(/\D/g, "") : null,
      });
    } else {
      const existing = parties.find((p) => p.reference === reference)!;
      if (!existing.isni && extra?.isni) existing.isni = extra.isni;
      if (!existing.ipi && extra?.ipi) existing.ipi = extra.ipi;
    }
    return reference;
  };

  for (const c of contributors) {
    ignoreSharePercent(c.share_percent);
    if (!c.name?.trim()) continue;
    const mapped = mapContributorRole(c.role);
    if (!mapped) continue;
    if (mapped.kind === "display" && mapped.role === "FeaturedArtist") {
      const ref = ensureParty(c.name.trim(), { isni: c.isni, ipi: c.ipi_cae });
      if (!featuredNames.includes(c.name.trim())) {
        featuredNames.push(c.name.trim());
        releaseDisplayArtists.push({
          partyReference: ref,
          role: "FeaturedArtist",
          sequence: releaseDisplayArtists.length + 1,
        });
      }
    } else if (mapped.kind !== "display") {
      ensureParty(c.name.trim(), { isni: c.isni, ipi: c.ipi_cae });
    }
  }

  const sortedTracks = [...tracks].sort((a, b) => a.track_number - b.track_number);
  if (sortedTracks.length === 0) errors.push("At least one track is required.");

  const artwork = pickArtwork(assets);
  if (!artwork) errors.push("Front cover artwork is required.");
  if (artwork && isPublicOrRemoteUrl(artwork.storage_path)) {
    errors.push("Artwork file reference cannot be a public URL.");
  }

  const cYear = parseLineYear(release.copyright_line, release.copyright_year);
  const pYear = parseLineYear(release.phonogram_line, release.copyright_year);
  if (!release.copyright_line?.trim() || !cYear) errors.push("Copyright (C) line/year is required.");
  if (!release.phonogram_line?.trim() || !pYear) errors.push("Phonogram (P) line/year is required.");

  const parental = parentalWarningFromExplicit(release.explicit);
  const deal = deals.find((d) => d.is_default !== false) ?? deals[0];
  if (!deal) errors.push("A release_deals row is required.");

  const territoryCheck = validateTerritories(deal?.territories?.length ? deal.territories : release.territories);
  if (territoryCheck.invalid.length) {
    errors.push(`Invalid territories: ${territoryCheck.invalid.join(", ")}.`);
  }
  if (territoryCheck.mapped.length === 0) errors.push("Deal territories are required.");

  const useTypes = (deal?.use_types ?? []).filter((u) => u?.trim());
  const commercial = (deal?.commercial_model_types ?? []).filter((u) => u?.trim());
  if (useTypes.length === 0) errors.push("Deal UseType is required.");
  if (commercial.length === 0) errors.push("Deal CommercialModelType is required.");
  const badUse = useTypes.filter((u) => !isAllowedUseType(u));
  const badModel = commercial.filter((u) => !isAllowedCommercialModel(u));
  if (badUse.length) errors.push(`Invalid UseType: ${badUse.join(", ")}.`);
  if (badModel.length) errors.push(`Invalid CommercialModelType: ${badModel.join(", ")}.`);

  const startDate = deal?.validity_start?.trim() || release.release_date?.trim() || "";
  if (!startDate) errors.push("Deal ValidityPeriod StartDate is required.");
  const releaseDate = release.release_date?.trim() || startDate;

  const imageRef = refs.imageResource();
  const imageTech = refs.imageTechnical();

  const soundRecordings = [];
  const trackReleases = [];
  const resourceGroup: Array<{ sequence: number; resourceReference: string }> = [];
  const durations: number[] = [];

  for (const track of sortedTracks) {
    const isrc = track.isrc?.trim() || "";
    if (!isrc) errors.push(`Track ${track.track_number} is missing ISRC (never fabricated).`);
    const audio = pickAudioAsset(assets, track.id);
    if (!audio) errors.push(`Track ${track.track_number} is missing an audio asset.`);
    if (audio && isPublicOrRemoteUrl(audio.storage_path)) {
      errors.push(`Track ${track.track_number} audio file reference cannot be a public URL.`);
    }
    const durationMs = track.duration_ms ?? audio?.duration_ms ?? null;
    if (durationMs == null) errors.push(`Track ${track.track_number} is missing duration.`);
    const warning = parentalWarningFromExplicit(track.explicit ?? release.explicit);

    const displayArtists: ErnDisplayArtist[] = [
      { partyReference: primaryRef, role: "MainArtist", sequence: 1 },
    ];
    const contribs: ErnContributor[] = [];
    let featuredSeq = 1;
    let contribSeq = 0;
    const trackFeatured: string[] = [];

    const applicable = contributors.filter(
      (c) => !c.track_id || c.track_id === track.id
    );
    for (const c of applicable) {
      ignoreSharePercent(c.share_percent);
      if (!c.name?.trim()) continue;
      const mapped = mapContributorRole(c.role);
      if (!mapped) {
        errors.push(`Unmapped contributor role "${c.role}" for ${c.name}.`);
        continue;
      }
      if (mapped.kind === "display" && mapped.role === "MainArtist") continue;
      const pref = ensureParty(c.name.trim(), { isni: c.isni, ipi: c.ipi_cae });
      if (mapped.kind === "display") {
        if (mapped.role === "FeaturedArtist") {
          featuredSeq += 1;
          displayArtists.push({
            partyReference: pref,
            role: "FeaturedArtist",
            sequence: featuredSeq,
          });
          if (!trackFeatured.includes(c.name.trim())) trackFeatured.push(c.name.trim());
        }
      } else {
        contribSeq += 1;
        contribs.push({ partyReference: pref, role: mapped.role, sequence: contribSeq });
      }
    }

    const resourceReference = refs.audioResource(track.track_number);
    resourceGroup.push({ sequence: track.track_number, resourceReference });
    if (durationMs != null) durations.push(durationMs);

    const hashAlgo = mapHashAlgorithm(audio?.hash_algorithm) ?? (audio?.checksum ? "SHA-256" : null);
    const fileUri = privateResourceUri("audio", audio?.filename || `track-${track.track_number}.wav`);

    soundRecordings.push({
      resourceReference,
      technicalReference: refs.audioTechnical(track.track_number),
      title: track.title,
      subtitle: track.version,
      isrc,
      durationIso: durationMs != null ? msToIsoDuration(durationMs) : "PT0S",
      parentalWarning: warning,
      displayArtistName: displayArtistName(primaryName, trackFeatured.length ? trackFeatured : featuredNames),
      displayArtists,
      contributors: contribs,
      pLineText: release.phonogram_line?.trim() || "",
      pLineYear: pYear ?? new Date().getUTCFullYear(),
      languageAndScriptCode: mapLanguageToCode(track.language || release.language),
      fileUri,
      hashAlgorithm: hashAlgo,
      hashValue: audio?.checksum?.trim() || null,
      codec: mapAudioCodec(audio?.codec),
      container: mapContainerFormat(audio?.container, audio?.filename),
      channels: audio?.channels ?? null,
      sampleRateHz: audio?.sample_rate_hz ?? null,
      bitDepth: audio?.bit_depth ?? null,
    });

    trackReleases.push({
      releaseReference: refs.trackRelease(track.track_number),
      resourceReference,
      proprietaryId: isrc || track.id,
      title: track.title,
      subtitle: track.version,
      genreText: genreText || "Pop",
      subgenre: release.subgenre,
    });
  }

  if (errors.length > 0) {
    throw new DdexMappingError(errors);
  }

  const messageId = options?.messageId || newMessageId();
  const createdAt = (options?.createdAt ?? new Date()).toISOString().replace(/\.(\d{3})Z$/, "Z");
  const filename = ern432Filename(release.title, messageId);

  return {
    languageAndScriptCode: lang,
    header: {
      messageId,
      messageThreadId: messageId,
      messageFileName: filename,
      createdAt,
      senderPartyId: cfg.senderPartyId!,
      senderName: cfg.senderName,
      recipientPartyId: cfg.recipientPartyId!,
      recipientName: cfg.recipientName || cfg.recipientConfigKey,
      messageControlType: cfg.messageControlType,
    },
    parties,
    soundRecordings,
    image: {
      resourceReference: imageRef,
      technicalReference: imageTech,
      proprietaryId: artwork!.id,
      title: release.title,
      parentalWarning: parental,
      cLineText: release.copyright_line!.trim(),
      cLineYear: cYear!,
      fileUri: privateResourceUri("image", artwork!.filename || "cover.jpg"),
      hashAlgorithm: mapHashAlgorithm(artwork!.hash_algorithm) ?? (artwork!.checksum ? "SHA-256" : null),
      hashValue: artwork!.checksum?.trim() || null,
      codec: mapImageCodec(artwork!.codec, artwork!.mime_type, artwork!.filename),
      width: artwork!.width ?? null,
      height: artwork!.height ?? null,
    },
    mainRelease: {
      releaseReference: refs.mainRelease(),
      releaseType: releaseType!,
      icpn: upc,
      title: release.title,
      subtitle: release.version,
      displayArtistName: displayArtistName(primaryName, featuredNames),
      displayArtists: releaseDisplayArtists,
      labelPartyReference: labelRef,
      pLineText: release.phonogram_line!.trim(),
      pLineYear: pYear!,
      cLineText: release.copyright_line!.trim(),
      cLineYear: cYear!,
      durationIso: durations.length ? sumDurationsIso(durations) : "PT0S",
      genreText: genreText!,
      subgenre: release.subgenre,
      releaseDate: releaseDate,
      originalReleaseDate: release.original_release_date?.trim() || null,
      parentalWarning: parental,
      resourceGroup,
      coverResourceReference: imageRef,
    },
    trackReleases,
    deal: {
      releaseReferences: [refs.mainRelease(), ...trackReleases.map((t) => t.releaseReference)],
      territories: territoryCheck.mapped,
      startDate,
      endDate: deal?.validity_end?.trim() || null,
      commercialModelTypes: commercial,
      useTypes,
    },
  };
}
