/**
 * DDEX / delivery readiness evaluation.
 * Differentiates Nexo-internal catalog readiness vs DSP/DDEX delivery readiness.
 * Missing ISRC/UPC flags delivery — does NOT block draft editing.
 * Never invents identifiers or tech metadata.
 */

export type ReadinessStatus = "READY" | "MISSING" | "REQUIRES_ACTION";

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
  | "audio_tech_meta"
  | "artwork_dimensions";

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
  territories?: string[] | null;
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
  deals?: Array<{ territories?: string[] | null }>;
};

export type ReadinessReport = {
  nexoStatus: ReadinessStatus;
  dspStatus: ReadinessStatus;
  items: ReadinessItem[];
  blocksDspDelivery: boolean;
};

function worst(a: ReadinessStatus, b: ReadinessStatus): ReadinessStatus {
  const rank = { READY: 0, REQUIRES_ACTION: 1, MISSING: 2 };
  return rank[a] >= rank[b] ? a : b;
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
      status: "MISSING",
      scope: "dsp",
      detail: "ISRCs required before DDEX delivery (drafts OK without).",
    });
  } else if (missingIsrc.length > 0) {
    items.push({
      key: "isrc",
      label: "ISRC codes",
      status: "MISSING",
      scope: "dsp",
      detail: `${missingIsrc.length} track(s) missing ISRC — required before DDEX delivery.`,
    });
  } else {
    items.push({ key: "isrc", label: "ISRC codes", status: "READY", scope: "dsp" });
  }

  if (!input.upc?.trim()) {
    items.push({
      key: "upc",
      label: "UPC / EAN",
      status: "MISSING",
      scope: "dsp",
      detail: "UPC required before DDEX delivery (drafts OK without).",
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

  const territorySource =
    deals.find((d) => (d.territories?.length ?? 0) > 0)?.territories ??
    input.territories ??
    [];
  items.push({
    key: "deal_territories",
    label: "Deal / territories",
    status: territorySource.length > 0 ? "READY" : "MISSING",
    scope: "dsp",
    detail:
      territorySource.length > 0
        ? undefined
        : "Set territories on the release or a release_deals row.",
  });

  const nexoItems = items.filter((i) => i.scope === "nexo");
  const dspItems = items.filter((i) => i.scope === "dsp");
  const nexoStatus = nexoItems.reduce<ReadinessStatus>((acc, i) => worst(acc, i.status), "READY");
  const dspStatus = dspItems.reduce<ReadinessStatus>((acc, i) => worst(acc, i.status), "READY");

  return {
    nexoStatus,
    dspStatus,
    items,
    blocksDspDelivery: dspStatus !== "READY",
  };
}
