export const PORTAL_SERVICE_KINDS = [
  "ringtone",
  "mastering",
  "sync",
  "physical",
  "dsp_pitching",
  "campaign",
  "third_party_playlisting",
  "ad_box",
  "influencers",
  "labs",
  "luminate",
  "youtube_allowlist",
  "youtube_manual_claim",
  "tiktok_manual_claim",
  "soundcloud_allowlist",
  "meta_allowlist",
] as const;

export type PortalServiceKind = (typeof PORTAL_SERVICE_KINDS)[number];

export function isPortalServiceKind(value: string): value is PortalServiceKind {
  return (PORTAL_SERVICE_KINDS as readonly string[]).includes(value);
}

export const SERVICE_KIND_LABEL: Record<PortalServiceKind, string> = {
  ringtone: "Create Ringtone",
  mastering: "Master Your Track",
  sync: "Sync Representation",
  physical: "Physical Distribution",
  dsp_pitching: "DSP Pitching",
  campaign: "Release Campaign Builder",
  third_party_playlisting: "Third Party Playlisting",
  ad_box: "Nexo Ad Box",
  influencers: "Influencers",
  labs: "Nexo Labs",
  luminate: "Luminate Registration",
  youtube_allowlist: "YouTube Allowlist",
  youtube_manual_claim: "YouTube Manual Claim",
  tiktok_manual_claim: "TikTok Manual Claim",
  soundcloud_allowlist: "SoundCloud Allowlist",
  meta_allowlist: "Meta Allowlist",
};

export const ANALYTICS_KEYS = [
  "streams",
  "meta",
  "youtube_ugc",
  "tiktok",
  "streamsafe",
  "spotify_discovery",
  "spotify_engagement",
  "downloads",
] as const;

export type AnalyticsKey = (typeof ANALYTICS_KEYS)[number];

export function isAnalyticsKey(value: string): value is AnalyticsKey {
  return (ANALYTICS_KEYS as readonly string[]).includes(value);
}

/** DSP codes we match on ingested ledger / import rows. Never invent counts. */
export const ANALYTICS_DSP_MATCH: Record<AnalyticsKey, string[]> = {
  streams: ["spotify", "apple", "apple_music", "audiomack", "amazon", "deezer", "tidal", "pandora", "youtube"],
  meta: ["meta", "facebook", "instagram"],
  youtube_ugc: ["youtube_ugc", "youtube", "yt_ugc"],
  tiktok: ["tiktok"],
  streamsafe: ["streamsafe"],
  spotify_discovery: ["spotify_discovery"],
  spotify_engagement: ["spotify", "spotify_engagement"],
  downloads: ["download", "itunes", "amazon_download"],
};
