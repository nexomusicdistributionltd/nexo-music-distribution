import type { PortalServiceKind } from "@/lib/portal/service-kinds";

export type MarketingProviderMode = "internal" | "toolost_manual" | "toolost_api";

export type MarketingServiceSpec = {
  kind: PortalServiceKind;
  label: string;
  requiresRelease: boolean;
  providerMode: MarketingProviderMode;
  providerFeature?: string;
  recommendedLeadDays?: number;
  guidance: string;
  adminGuidance: string;
};

export const MARKETING_SERVICE_SPECS = [
  {
    kind: "dsp_pitching",
    label: "DSP Pitching",
    requiresRelease: true,
    providerMode: "toolost_manual",
    providerFeature: "pitch_portal",
    recommendedLeadDays: 21,
    guidance:
      "Submit an upcoming release for editorial and promotional consideration. Selection or placement is never guaranteed.",
    adminGuidance:
      "Verify the release is upcoming and provider-delivered. Record only a real provider submission/reference.",
  },
  {
    kind: "campaign",
    label: "Release Campaign Builder",
    requiresRelease: true,
    providerMode: "internal",
    guidance:
      "Build a release campaign request around a real Nexo release, objectives, dates, assets and budget.",
    adminGuidance:
      "Operate this as a Nexo campaign workflow. Do not mark execution steps complete until the work is actually done.",
  },
  {
    kind: "priority_pitch",
    label: "Priority Pitch",
    requiresRelease: true,
    providerMode: "toolost_manual",
    providerFeature: "priority_pitch",
    recommendedLeadDays: 21,
    guidance:
      "Submit one upcoming release for priority pitching consideration. The release must remain unreleased when submitted.",
    adminGuidance:
      "TooLost documents one song per unreleased TooLost-distributed release and recommends 3–4 weeks lead time.",
  },
  {
    kind: "spotify_discovery_mode",
    label: "Spotify Discovery Mode",
    requiresRelease: true,
    providerMode: "toolost_manual",
    providerFeature: "spotify_discovery_mode",
    guidance:
      "Request eligibility review and enrollment for Spotify Discovery Mode. Enrollment depends on Spotify/provider eligibility.",
    adminGuidance:
      "Confirm the real Spotify/provider eligibility state before marking approved, processing or live.",
  },
  {
    kind: "promotional_assets",
    label: "Promotional Assets",
    requiresRelease: true,
    providerMode: "toolost_manual",
    providerFeature: "promotional_assets",
    guidance:
      "Request promotional creative tied to a real release. Delivered assets appear only after a real asset URL/reference is saved.",
    adminGuidance:
      "Use the documented provider asset workflow when available and save only actual deliverables.",
  },
  {
    kind: "fan_blast",
    label: "Fan Blast",
    requiresRelease: false,
    providerMode: "toolost_manual",
    providerFeature: "fan_blast",
    guidance:
      "Request a fan communication campaign using an audience you are authorized to contact.",
    adminGuidance:
      "Confirm audience consent/source. Do not invent recipient, delivery, open or click metrics.",
  },
  {
    kind: "award_monitoring",
    label: "Award Monitoring",
    requiresRelease: false,
    providerMode: "toolost_manual",
    providerFeature: "award_monitoring",
    guidance:
      "Request monitoring for verified certification and award progress across eligible catalog.",
    adminGuidance:
      "Record only provider-reported or independently verified certification progress.",
  },
  {
    kind: "third_party_playlisting",
    label: "Third Party Playlisting",
    requiresRelease: true,
    providerMode: "internal",
    guidance:
      "Request human-reviewed third-party playlist outreach. No placement is guaranteed.",
    adminGuidance:
      "Keep outreach compliant. Never represent paid or unverified placement as editorial support.",
  },
  {
    kind: "ad_box",
    label: "Nexo Ad Box",
    requiresRelease: true,
    providerMode: "internal",
    guidance:
      "Request a Nexo-managed ad campaign tied to a release. Campaigns require approved budget and creative.",
    adminGuidance:
      "Require real platform campaign IDs/results once launched; never estimate performance as delivered data.",
  },
  {
    kind: "influencers",
    label: "Influencers",
    requiresRelease: true,
    providerMode: "internal",
    guidance:
      "Request influencer sourcing/outreach for a release. Creator participation is not guaranteed.",
    adminGuidance:
      "Save confirmed creator approvals and live post URLs/results only.",
  },
  {
    kind: "labs",
    label: "Nexo Labs",
    requiresRelease: false,
    providerMode: "internal",
    guidance:
      "Opt into experimental Nexo tools that are actually enabled for your account.",
    adminGuidance:
      "Only activate features that are genuinely available.",
  },
  {
    kind: "luminate",
    label: "Luminate Registration",
    requiresRelease: true,
    providerMode: "toolost_manual",
    providerFeature: "chart_registration",
    guidance:
      "Request release registration for chart tracking. Registration status remains pending until a real provider confirmation exists.",
    adminGuidance:
      "TooLost documents Chart Registration for Luminate/Mediabase. Record the actual registration state/reference.",
  },
] as const satisfies readonly MarketingServiceSpec[];

const byKind = new Map<string, MarketingServiceSpec>(
  MARKETING_SERVICE_SPECS.map((spec) => [spec.kind, spec])
);

export function marketingServiceSpec(kind: string | null | undefined): MarketingServiceSpec | null {
  return kind ? byKind.get(kind) ?? null : null;
}

export function isMarketingServiceKind(kind: string): boolean {
  return byKind.has(kind);
}
