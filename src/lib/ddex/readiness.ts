/**
 * DDEX / delivery readiness evaluation.
 * Differentiates Nexo-internal catalog readiness vs DSP/DDEX delivery readiness.
 * Missing ISRC/UPC flags delivery — does NOT block draft editing.
 * Never invents identifiers or tech metadata.
 * Generation is blocked unless dspStatus === READY and canGenerate.
 */

import { mapGenreToAvs } from "./genre-map";
import { isAllowedCommercialModel, isAllowedUseType } from "./avs-maps";
import { validateTerritories } from "./territories";

export type ReadinessStatus = "READY" | "MISSING" | "REQUIRES_ACTION" | "ERROR";

export type ReadinessCheckKey =
  | "isrc"
  | "upc"
  | "audio"
  | "artwork"
  | "copyright_line"
  | "phonogram_line"
  | "artist_link"
  | "contributors"
  | "deal_territories"
  | "deal_use_types"
  | "deal_commercial_models"
  | "deal_validity"
  | "genre"
  | "audio_tech_meta"
  | "artwork_dimensions"
  | "sender_dpid"
  | "recipient";

export type ReadinessItem = {
  key: ReadinessCheckKey;
  label: string;
  status: ReadinessStatus;
  scope: "nexo" | "dsp";
  detail?: string;
};

export type ReadinessInput = {
  upc?: string | null;
  copyright_line?: string | null;
  phonogram_line?: string | null;
  artist_profile_id?: string | null;
  primary_artist_name?: string | null;
  genre?: string | null;
  territories?: string[] | null;
  release_date?: string | null;
  tracks?: Array<{
    id?: string;
    isrc?: string | null;
    title?: string | null;
    duration_ms?: number | null;
  }>;
  contributors?: Array<{ name?: string | null; role?: string | null }>;
  assets?: Array<{
    kind?: string | null;
    track_id?: string | null;
    width?: number | null;
    height?: number | null;
    duration_ms?: number | null;
    sample_rate_hz?: number | null;
    checksum?: string | null;
    codec?: string | null;
  }>;
  deals?: Array<{
    territories?: string[] | null;
    use_types?: string[] | null;
    commercial_model_types?: string[] | null;
    validity_start?: string | null;
    validity_end?: string | null;
  }>;
  senderConfigured?: boolean;
  recipientConfigured?: boolean;
};

export type ReadinessReport = {
  nexoStatus: ReadinessStatus;
  dspStatus: ReadinessStatus;
  items: ReadinessItem[];
  blocksDspDelivery: boolean;
  canGenerate: boolean;
  errors: string[];
};

function worst(a: ReadinessStatus, b: ReadinessStatus): ReadinessStatus {
  const rank = { READY: 0, REQUIRES_ACTION: 1, MISSING: 2, ERROR: 3 };
  return rank[a] >= rank[b] ? a : b;
}

function blocking(status: ReadinessStatus): boolean {
  return status === "MISSING" || status === "ERROR";
}

export function evaluateReleaseReadiness(input: ReadinessInput): ReadinessReport {
  const items: ReadinessItem[] = [];
  const tracks = input.tracks ?? [];
  const assets = input.assets ?? [];
  const contributors = input.contributors ?? [];
  const deals = input.deals ?? [];

  const audioAssets = assets.filter((a) => a.kind === "audio");
  const artwork = assets.find((a) => a.kind === "artwork");

  if (!artwork) {
    items.push({
      key: "artwork",
      label: "Cover artwork",
      status: "MISSING",
      scope: "nexo",
      detail: "Upload cover art before submit.",
    });
  } else {
    items.push({ key: "artwork", label: "Cover artwork", status: "READY", scope: "nexo" });
    const dimsOk =
      typeof artwork.width === "number" &&
      typeof artwork.height === "number" &&
      artwork.width >= 1400 &&
      artwork.height >= 1400;
    items.push({
      key: "artwork_dimensions",
      label: "Artwork dimensions",
      status: dimsOk ? "READY" : "REQUIRES_ACTION",
      scope: "dsp",
      detail: dimsOk
        ? undefined
        : "Artwork width/height missing or below typical DSP minimum (1400×1400).",
    });
  }

  if (tracks.length === 0) {
    items.push({
      key: "audio",
      label: "Tracks / audio",
      status: "MISSING",
      scope: "nexo",
      detail: "Add at least one track.",
    });
  } else if (audioAssets.length === 0) {
    items.push({
      key: "audio",
      label: "Tracks / audio",
      status: "MISSING",
      scope: "nexo",
      detail: "Upload audio for tracks.",
    });
  } else {
    items.push({ key: "audio", label: "Tracks / audio", status: "READY", scope: "nexo" });
  }

  const techIncomplete = audioAssets.some(
    (a) => a.duration_ms == null || a.sample_rate_hz == null || !a.checksum
  );
  if (audioAssets.length > 0) {
    items.push({
      key: "audio_tech_meta",
      label: "Audio technical metadata",
      status: techIncomplete ? "REQUIRES_ACTION" : "READY",
      scope: "dsp",
      detail: techIncomplete
        ? "Duration, sample rate, or checksum missing after extraction — values are never invented."
        : undefined,
    });
  }

  const missingIsrc = tracks.filter((t) => !t.isrc?.trim());
  if (tracks.length === 0) {
    items.push({
      key: "isrc",
      label: "ISRC codes",
      status: "ERROR",
      scope: "dsp",
      detail: "ISRCs required before DDEX delivery (drafts OK without). Never fabricated.",
    });
  } else if (missingIsrc.length > 0) {
    items.push({
      key: "isrc",
      label: "ISRC codes",
      status: "ERROR",
      scope: "dsp",
      detail: `${missingIsrc.length} track(s) missing ISRC — required before DDEX delivery. Never fabricated.`,
    });
  } else {
    items.push({ key: "isrc", label: "ISRC codes", status: "READY", scope: "dsp" });
  }

  if (!input.upc?.trim()) {
    items.push({
      key: "upc",
      label: "UPC / EAN",
      status: "ERROR",
      scope: "dsp",
      detail: "UPC required before DDEX delivery (drafts OK without). Never fabricated.",
    });
  } else {
    items.push({ key: "upc", label: "UPC / EAN", status: "READY", scope: "dsp" });
  }

  items.push({
    key: "copyright_line",
    label: "Copyright (C) line",
    status: input.copyright_line?.trim() ? "READY" : "MISSING",
    scope: "nexo",
  });
  items.push({
    key: "phonogram_line",
    label: "Phonogram (P) line",
    status: input.phonogram_line?.trim() ? "READY" : "MISSING",
    scope: "nexo",
  });

  items.push({
    key: "artist_link",
    label: "Artist profile / primary artist",
    status: input.artist_profile_id
      ? "READY"
      : input.primary_artist_name?.trim()
        ? "REQUIRES_ACTION"
        : "MISSING",
    scope: "nexo",
    detail: input.artist_profile_id
      ? undefined
      : input.primary_artist_name?.trim()
        ? "Primary artist name set but artist_profile_id not linked (labels must select roster artist)."
        : "Link an artist profile or set primary artist name.",
  });

  items.push({
    key: "contributors",
    label: "Contributors",
    status: contributors.some((c) => c.name?.trim()) ? "READY" : "MISSING",
    scope: "nexo",
  });

  const genre = mapGenreToAvs(input.genre);
  items.push({
    key: "genre",
    label: "Genre map",
    status: genre ? "READY" : "ERROR",
    scope: "dsp",
    detail: genre ? undefined : "Genre missing or unmapped — will not be invented in ERN.",
  });

  const deal = deals[0];
  const territorySource = deal?.territories?.length ? deal.territories : input.territories ?? [];
  const territoryCheck = validateTerritories(territorySource);
  if (territoryCheck.invalid.length > 0) {
    items.push({
      key: "deal_territories",
      label: "Deal / territories",
      status: "ERROR",
      scope: "dsp",
      detail: `Invalid territories: ${territoryCheck.invalid.join(", ")}.`,
    });
  } else if (!territoryCheck.ok) {
    items.push({
      key: "deal_territories",
      label: "Deal / territories",
      status: "MISSING",
      scope: "dsp",
      detail: "Set territories on a release_deals row.",
    });
  } else {
    items.push({
      key: "deal_territories",
      label: "Deal / territories",
      status: "READY",
      scope: "dsp",
    });
  }

  const useTypes = deal?.use_types?.filter((u) => u?.trim()) ?? [];
  const badUse = useTypes.filter((u) => !isAllowedUseType(u));
  items.push({
    key: "deal_use_types",
    label: "Deal UseType",
    status: useTypes.length === 0 ? "MISSING" : badUse.length ? "ERROR" : "READY",
    scope: "dsp",
    detail:
      useTypes.length === 0
        ? "release_deals.use_types is required."
        : badUse.length
          ? `Invalid UseType: ${badUse.join(", ")}.`
          : undefined,
  });

  const models = deal?.commercial_model_types?.filter((u) => u?.trim()) ?? [];
  const badModel = models.filter((u) => !isAllowedCommercialModel(u));
  items.push({
    key: "deal_commercial_models",
    label: "Deal CommercialModelType",
    status: models.length === 0 ? "MISSING" : badModel.length ? "ERROR" : "READY",
    scope: "dsp",
    detail:
      models.length === 0
        ? "release_deals.commercial_model_types is required."
        : badModel.length
          ? `Invalid CommercialModelType: ${badModel.join(", ")}.`
          : undefined,
  });

  items.push({
    key: "deal_validity",
    label: "Deal ValidityPeriod",
    status: deal?.validity_start?.trim() || input.release_date?.trim() ? "READY" : "MISSING",
    scope: "dsp",
    detail:
      deal?.validity_start?.trim() || input.release_date?.trim()
        ? undefined
        : "release_deals.validity_start or release_date is required for ValidityPeriod.",
  });

  if (input.senderConfigured === false) {
    items.push({
      key: "sender_dpid",
      label: "Sender DPID",
      status: "ERROR",
      scope: "dsp",
      detail: "NEXO_DPID is not configured on the server.",
    });
  } else if (input.senderConfigured === true) {
    items.push({
      key: "sender_dpid",
      label: "Sender DPID",
      status: "READY",
      scope: "dsp",
    });
  }

  if (input.recipientConfigured === false) {
    items.push({
      key: "recipient",
      label: "Recipient",
      status: "ERROR",
      scope: "dsp",
      detail: "No recipient DPID configured (test recipient only if explicitly set).",
    });
  } else if (input.recipientConfigured === true) {
    items.push({
      key: "recipient",
      label: "Recipient",
      status: "READY",
      scope: "dsp",
    });
  }

  const nexoItems = items.filter((i) => i.scope === "nexo");
  const dspItems = items.filter((i) => i.scope === "dsp");
  const nexoStatus = nexoItems.reduce<ReadinessStatus>((acc, i) => worst(acc, i.status), "READY");
  const dspStatus = dspItems.reduce<ReadinessStatus>((acc, i) => worst(acc, i.status), "READY");
  const errors = items
    .filter((i) => blocking(i.status) || i.status === "REQUIRES_ACTION")
    .filter((i) => i.scope === "dsp" || blocking(i.status))
    .map((i) => i.detail || `${i.label}: ${i.status}`);

  const canGenerate =
    !items.some((i) => blocking(i.status) || (i.scope === "dsp" && i.status === "REQUIRES_ACTION"));

  return {
    nexoStatus,
    dspStatus,
    items,
    blocksDspDelivery: dspStatus !== "READY",
    canGenerate,
    errors,
  };
}
