export const PORTAL_SERVICE_KINDS = [
  "ringtone",
  "profile_defender",
  "priority_pitch",
  "usage_discovery",
  "chart_registration",
  "cover_song_licensing",
  "audio_recognition",
  "spotify_discovery_mode",
  "tiktok_cml",
  "promotional_assets",
  "fan_blast",
  "award_monitoring",
  "conflict_resolution",
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

/** Optional services shown on Enrollments. Unenrolled until a real row exists. */
export const ENROLLABLE_SERVICES = [
  { key: "playlist_pitching", label: "Playlist pitching" },
  { key: "nexo_labs", label: "Nexo Labs" },
  { key: "luminate", label: "Luminate registration" },
  { key: "sync", label: "Sync representation" },
  { key: "physical", label: "Physical distribution" },
  { key: "ad_box", label: "Nexo Ad Box" },
] as const;

export const SERVICE_KIND_LABEL: Record<PortalServiceKind, string> = {
  ringtone: "Create Ringtone",
  profile_defender: "Profile Defender",
  priority_pitch: "Priority Pitch",
  usage_discovery: "Usage Discovery",
  chart_registration: "Chart Registration",
  cover_song_licensing: "Cover Song Licensing",
  audio_recognition: "Audio Recognition",
  spotify_discovery_mode: "Spotify Discovery Mode",
  tiktok_cml: "TikTok CML",
  promotional_assets: "Promotional Assets",
  fan_blast: "Fan Blast",
  award_monitoring: "Award Monitoring",
  conflict_resolution: "Conflict Resolution",
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

/** Platform/source aliases used to classify live provider analytics rows. */
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
