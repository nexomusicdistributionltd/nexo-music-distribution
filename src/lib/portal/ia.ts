import type { NavItem, NavSection, WorkspaceKind } from "@/lib/auth/nav";

export type PortalVisibility = "all" | "artist" | "label";

export type PortalPageKind =
  | "existing"
  | "service"
  | "analytics"
  | "knowledge"
  | "videos"
  | "payees"
  | "assignments"
  | "recoupments"
  | "members"
  | "enrollments"
  | "labels"
  | "payment-tax"
  | "tracks"
  | "artist-self";

export type PortalNavItem = NavItem & {
  external?: boolean;
  badge?: "NEW";
  visibility?: PortalVisibility;
  pageKind: PortalPageKind;
  serviceKind?: string;
  analyticsKey?: string;
  knowledgeSlug?: string;
  description: string;
  requiresAdvancedAnalytics?: boolean;
};

export type PortalNavSection = NavSection & {
  groups: PortalNavItem[][];
  items: PortalNavItem[];
};

function flattenGroups(groups: PortalNavItem[][]): PortalNavItem[] {
  return groups.flat();
}

function item(
  partial: Omit<PortalNavItem, "description"> & { description?: string }
): PortalNavItem {
  return {
    ...partial,
    description:
      partial.description ??
      `${partial.label} for NEXO MUSIC DISTRIBUTION LTD — live account data only.`,
  };
}


function mainGroups(): PortalNavItem[][] {
  return [[
    item({ href: "/dashboard", label: "Dashboard", pageKind: "existing", description: "Your Nexo workspace overview." }),
    item({ href: "/dashboard/releases", label: "Releases", pageKind: "existing", description: "Your release catalog and QC status." }),
    item({ href: "/wallet", label: "Wallet", pageKind: "existing", description: "Royalty balance, payout methods, payouts, reports and transaction activity." }),
  ]];
}

function salesGroups(): PortalNavItem[][] {
  return [[
    item({ href: "/sales", label: "Overview", pageKind: "analytics", analyticsKey: "sales_overview", description: "Distribution sales overview from live provider data with Nexo ledger fallback." }),
    item({ href: "/sales/releases", label: "Releases", pageKind: "analytics", analyticsKey: "sales_releases", description: "Sales performance grouped by release." }),
    item({ href: "/sales/tracks", label: "Tracks", pageKind: "analytics", analyticsKey: "sales_tracks", description: "Sales performance grouped by track." }),
    item({ href: "/sales/stores", label: "Stores/Services", pageKind: "analytics", analyticsKey: "sales_stores", description: "Sales by DSP, store or service." }),
    item({ href: "/sales/artists", label: "Artists", pageKind: "analytics", analyticsKey: "sales_artists", description: "Sales grouped by artist." }),
    item({ href: "/sales/territories", label: "Territories", pageKind: "analytics", analyticsKey: "sales_territories", description: "Sales and usage grouped by territory." }),
    item({ href: "/sales/monthly", label: "Monthly Overviews", pageKind: "analytics", analyticsKey: "sales_monthly", description: "Monthly sales and royalty activity." }),
    item({ href: "/sales/stream-rate", label: "Stream Rate", pageKind: "analytics", analyticsKey: "stream_rate", description: "Provider stream-rate data where supplied." }),
  ]];
}

function reportsGroups(): PortalNavItem[][] {
  return [[
    item({ href: "/reports", label: "Overview", pageKind: "analytics", analyticsKey: "reports_overview", description: "Account reporting overview built from live Nexo records." }),
    item({ href: "/reports/sales", label: "Sales", pageKind: "analytics", analyticsKey: "reports_sales", description: "Sales reporting for your owned catalog." }),
    item({ href: "/reports/catalog", label: "Catalog", pageKind: "analytics", analyticsKey: "reports_catalog", description: "Catalog report across your releases and tracks." }),
    item({ href: "/reports/payouts", label: "Payouts", pageKind: "analytics", analyticsKey: "reports_payouts", description: "Payout history and reporting." }),
    item({ href: "/reports/release-links", label: "Release Links", pageKind: "analytics", analyticsKey: "reports_release_links", description: "Fanlink and release-link reporting." }),
    item({ href: "/reports/additional", label: "Additional Reports", pageKind: "analytics", analyticsKey: "reports_additional", description: "Additional verified account reporting." }),
    item({ href: "/reports/stream-data", label: "Stream Data", pageKind: "analytics", analyticsKey: "reports_stream_data", description: "Stream-level analytics where the Distribution Engine provides them." }),
    item({ href: "/reports/raw-data", label: "Raw Data", pageKind: "analytics", analyticsKey: "reports_raw_data", description: "Raw provider/ledger-backed reporting without invented values." }),
  ]];
}

function catalogGroups(kind: Exclude<WorkspaceKind, "admin">): PortalNavItem[][] {
  const artistsItem =
    kind === "label"
      ? item({
          href: "/app/artists",
          label: "Artists",
          pageKind: "existing",
          visibility: "label",
          description: "Label roster. Create artist does not create a login.",
        })
      : item({
          href: "/dashboard/artists",
          label: "Artists",
          pageKind: "artist-self",
          visibility: "artist",
          description: "Your artist catalog and DSP profile links.",
        });

  const createArtist: PortalNavItem[] =
    kind === "label"
      ? [
          item({
            href: "/app/artists/new",
            label: "Create Artist",
            pageKind: "existing",
            visibility: "label",
            description: "Add a managed roster artist with optional bio.",
          }),
        ]
      : [];

  return [
    [
      artistsItem,
      ...createArtist,
      item({ href: "/dashboard/fanlinks", label: "Fanlinks", pageKind: "existing", description: "Public Nexo smart links for your live releases, with DSP clicks and preview status." }),
    ],
    [
      item({
        href: "/dashboard/releases/new",
        label: "Create Release",
        pageKind: "existing",
        description: "Start a single, EP, or album.",
      }),
      item({
        href: "/dashboard/videos",
        label: "Upload Music Video",
        pageKind: "videos",
        description: "Submit a music video URL for distribution review.",
      }),
      item({
        href: "/catalog/ringtone",
        label: "Create Ringtone",
        pageKind: "service",
        serviceKind: "ringtone",
        description: "Request a ringtone cut from a track you own.",
      }),
      item({
        href: "/dashboard/catalog/move-in",
        label: "Transfer Track",
        pageKind: "existing",
        description: "Move in catalog from another distributor.",
      }),
      item({
        href: "/catalog/mastering",
        label: "Master Your Track",
        pageKind: "service",
        serviceKind: "mastering",
        description: "Request mastering notes for a release or track.",
      }),
    ],
    [
      item({
        href: "/catalog/sync",
        label: "Sync Representation",
        pageKind: "service",
        serviceKind: "sync",
        external: true,
        description: "Request Nexo sync representation review — not a placement guarantee.",
      }),
      item({
        href: "/catalog/physical",
        label: "Physical Distribution",
        pageKind: "service",
        serviceKind: "physical",
        external: true,
        description: "Request vinyl/CD/cassette fulfillment review.",
      }),
    ],
  ];
}

function marketingGroups(): PortalNavItem[][] {
  return [
    [
      item({
        href: "/marketing/dsp-pitching",
        label: "DSP Pitching",
        pageKind: "service",
        serviceKind: "dsp_pitching",
        description: "Pitch a release to Nexo for DSP editorial consideration.",
      }),
      item({
        href: "/marketing/campaigns",
        label: "Release Campaign Builder",
        pageKind: "service",
        serviceKind: "campaign",
        description: "Outline a release campaign for staff review.",
      }),
      item({
        href: "/marketing/third-party-playlisting",
        label: "Third Party Playlisting",
        pageKind: "service",
        serviceKind: "third_party_playlisting",
        description: "Request third-party playlist outreach. Not a DSP connection.",
      }),
      item({
        href: "/marketing/ad-box",
        label: "Nexo Ad Box",
        pageKind: "service",
        serviceKind: "ad_box",
        description: "Request paid-ad creative support. Ads are not run until you confirm spend.",
      }),
      item({
        href: "/marketing/influencers",
        label: "Influencers",
        pageKind: "service",
        serviceKind: "influencers",
        description: "Request influencer outreach. No invented creator stats.",
      }),
      item({
        href: "/dashboard/playlist-pitch",
        label: "Playlist pitching",
        pageKind: "existing",
        external: true,
        description: "Pitch Nexo-operated playlists. Staff review required.",
      }),
      item({
        href: "/marketing/offerings",
        label: "Client Offerings",
        pageKind: "knowledge",
        knowledgeSlug: "client-offerings",
        description: "Current optional Nexo marketing services.",
      }),
      item({
        href: "/marketing/labs",
        label: "Nexo Labs",
        pageKind: "service",
        serviceKind: "labs",
        description: "Opt into experimental Nexo tools. Not a third-party product.",
      }),
      item({
        href: "/marketing/luminate",
        label: "Luminate Registration",
        pageKind: "service",
        serviceKind: "luminate",
        description: "Request Luminate registration assistance. Status stays pending until confirmed.",
      }),
      item({
        href: "/help/marketing-best-practices",
        label: "Marketing Best Practices",
        pageKind: "knowledge",
        knowledgeSlug: "marketing-best-practices",
        external: true,
        description: "Nexo guidance for release marketing.",
      }),
      item({ href: "/marketing/priority-pitch", label: "Priority Pitch", pageKind: "service", serviceKind: "priority_pitch", description: "Submit a priority pitching request for staff review." }),
      item({ href: "/marketing/chart-registration", label: "Chart Registration", pageKind: "service", serviceKind: "chart_registration", description: "Request chart-registration support for an eligible release." }),
      item({ href: "/marketing/audio-recognition", label: "Audio Recognition", pageKind: "service", serviceKind: "audio_recognition", description: "Request audio-recognition/fingerprinting support for eligible recordings." }),
      item({ href: "/marketing/tiktok-cml", label: "TikTok CML", pageKind: "service", serviceKind: "tiktok_cml", description: "Request TikTok Commercial Music Library review or support." }),
      item({ href: "/marketing/promotional-assets", label: "Promotional Assets", pageKind: "service", serviceKind: "promotional_assets", description: "Request release promotional assets and campaign materials." }),
      item({ href: "/marketing/fan-blast", label: "Fan Blast", pageKind: "service", serviceKind: "fan_blast", description: "Request a Nexo fan-outreach campaign." }),
      item({ href: "/marketing/ai-mastering", label: "AI Mastering", pageKind: "service", serviceKind: "ai_mastering", description: "Request automated mastering review for a track you control." }),
      item({ href: "/marketing/award-monitoring", label: "Award Monitoring", pageKind: "service", serviceKind: "award_monitoring", description: "Request award-eligibility and monitoring support." }),
    ],
  ];
}

function analyticsGroups(): PortalNavItem[][] {
  return [
    [
      item({ href: "/analytics/overview", label: "Overview", pageKind: "analytics", analyticsKey: "analytics_overview", description: "Distribution analytics overview for your catalog.", requiresAdvancedAnalytics: true }),
      item({ href: "/analytics/by-platform", label: "By Platform", pageKind: "analytics", analyticsKey: "by_platform", description: "Analytics grouped by platform or service.", requiresAdvancedAnalytics: true }),
      item({ href: "/analytics/by-release", label: "By Release", pageKind: "analytics", analyticsKey: "by_release", description: "Analytics grouped by release.", requiresAdvancedAnalytics: true }),
      item({ href: "/analytics/usage-discovery", label: "Usage Discovery", pageKind: "analytics", analyticsKey: "usage_discovery", description: "Discover verified usage activity across available provider analytics.", requiresAdvancedAnalytics: true }),
      item({ href: "/analytics/insights", label: "Insights", pageKind: "analytics", analyticsKey: "insights", description: "Catalog performance insights from verified data.", requiresAdvancedAnalytics: true }),
      item({ href: "/analytics/audience", label: "Audience", pageKind: "analytics", analyticsKey: "audience", description: "Audience signals supplied by the Distribution Engine.", requiresAdvancedAnalytics: true }),
      item({
        href: "/analytics/streams",
        label: "Streams",
        pageKind: "analytics",
        analyticsKey: "streams",
        requiresAdvancedAnalytics: true,
        description: "Statement-backed stream rows only.",
      }),
      item({
        href: "/analytics/meta",
        label: "Meta",
        pageKind: "analytics",
        analyticsKey: "meta",
        requiresAdvancedAnalytics: true,
        description: "Meta usage from ingested statements, otherwise not connected.",
      }),
      item({
        href: "/analytics/youtube-ugc",
        label: "YouTube UGC",
        pageKind: "analytics",
        analyticsKey: "youtube_ugc",
        requiresAdvancedAnalytics: true,
        description: "YouTube UGC rows from statements only.",
      }),
      item({
        href: "/analytics/tiktok",
        label: "TikTok",
        pageKind: "analytics",
        analyticsKey: "tiktok",
        requiresAdvancedAnalytics: true,
        description: "TikTok rows from statements only.",
      }),
      item({
        href: "/analytics/streamsafe",
        label: "StreamSafe",
        pageKind: "analytics",
        analyticsKey: "streamsafe",
        requiresAdvancedAnalytics: true,
        description: "Suspicious-stream flags if ingested. Never invented.",
      }),
      item({
        href: "/analytics/spotify-discovery",
        label: "Spotify Discovery Mode",
        pageKind: "analytics",
        analyticsKey: "spotify_discovery",
        requiresAdvancedAnalytics: true,
        description: "Discovery Mode is not connected unless a real enrollment exists.",
      }),
      item({
        href: "/analytics/spotify-engagement",
        label: "Spotify Engagement",
        pageKind: "analytics",
        analyticsKey: "spotify_engagement",
        requiresAdvancedAnalytics: true,
        badge: "NEW",
        description: "Engagement metrics from ingested Spotify statement rows only.",
      }),
      item({
        href: "/analytics/downloads",
        label: "Downloads",
        pageKind: "analytics",
        analyticsKey: "downloads",
        requiresAdvancedAnalytics: true,
        description: "Download rows from statements only.",
      }),
    ],
  ];
}

function royaltiesGroups(): PortalNavItem[][] {
  return [
    [
      item({
        href: "/earnings",
        label: "Royalty Summary",
        pageKind: "existing",
        description: "Ledger balances — not estimates.",
      }),
      item({
        href: "/earnings/payouts",
        label: "Request Payment",
        pageKind: "existing",
        description: "Request a payout from available ledger balance.",
      }),
    ],
    [
      item({
        href: "/earnings/tracks",
        label: "Tracks",
        pageKind: "tracks",
        description: "Tracks in your catalog with royalty lines when posted.",
      }),
    ],
    [
      item({
        href: "/help/royalties",
        label: "Royalties Help",
        pageKind: "knowledge",
        knowledgeSlug: "royalties-help",
        external: true,
        description: "How Nexo royalties, statements, and payouts work.",
      }),
    ],
  ];
}

function splitShareGroups(): PortalNavItem[][] {
  return [
    [
      item({
        href: "/splitshare/guide",
        label: "Quick Start Guide",
        pageKind: "knowledge",
        knowledgeSlug: "splitshare-guide",
        description: "How splits, payees, and recoupments work at Nexo.",
      }),
      item({
        href: "/earnings/splits",
        label: "Splits",
        pageKind: "existing",
        description: "Royalty split rules you own.",
      }),
      item({
        href: "/splitshare/assignments",
        label: "Track Assignments",
        pageKind: "assignments",
        description: "Assign a split rule to a track.",
      }),
      item({
        href: "/splitshare/payees",
        label: "Payees",
        pageKind: "payees",
        description: "People or companies who can receive split shares.",
      }),
      item({
        href: "/splitshare/recoupments",
        label: "Recoupments",
        pageKind: "recoupments",
        description: "Record recoupable balances. Nothing is invented.",
      }),
    ],
  ];
}

function rightsGroups(): PortalNavItem[][] {
  return [
    [
      item({ href: "/rights/greenlist", label: "Greenlist", pageKind: "service", serviceKind: "greenlist", description: "Request allowlisting for approved accounts or channels using your protected music." }),
      item({ href: "/rights/blocklist", label: "Blocklist", pageKind: "service", serviceKind: "blocklist", description: "Request blocking of unauthorized usage on supported services." }),
      item({ href: "/rights/profile-defender", label: "Profile Defender", pageKind: "service", serviceKind: "profile_defender", description: "Report suspicious artist-profile activity, impersonation or catalog conflicts." }),
      item({
        href: "/rights/youtube-allowlist",
        label: "YouTube Allowlist",
        pageKind: "service",
        serviceKind: "youtube_allowlist",
        description: "Request YouTube Content ID allowlisting for a channel.",
      }),
      item({
        href: "/rights/youtube-manual-claim",
        label: "YouTube Manual Claim",
        pageKind: "service",
        serviceKind: "youtube_manual_claim",
        description: "Request a manual YouTube claim review.",
      }),
      item({
        href: "/help/youtube-oac",
        label: "YouTube Official Artist Channel",
        pageKind: "knowledge",
        knowledgeSlug: "youtube-oac",
        external: true,
        description: "How Nexo helps with Official Artist Channel requests.",
      }),
    ],
    [
      item({
        href: "/rights/tiktok-manual-claim",
        label: "TikTok Manual Claim",
        pageKind: "service",
        serviceKind: "tiktok_manual_claim",
        description: "Request a TikTok sound/video claim review.",
      }),
    ],
    [
      item({
        href: "/rights/soundcloud-allowlist",
        label: "SoundCloud Allowlist",
        pageKind: "service",
        serviceKind: "soundcloud_allowlist",
        description: "Request SoundCloud allowlisting for a profile.",
      }),
    ],
    [
      item({
        href: "/rights/meta-allowlist",
        label: "Meta Allowlist",
        pageKind: "service",
        serviceKind: "meta_allowlist",
        description: "Request Meta Rights Manager allowlisting.",
      }),
    ],
    [
      item({
        href: "/help/copyright-your-music",
        label: "Copyright Your Music",
        pageKind: "knowledge",
        knowledgeSlug: "copyright-your-music",
        external: true,
        description: "Copyright basics for Nexo clients — not legal advice.",
      }),
      item({
        href: "/help/cover-song-licensing",
        label: "Cover Song Licensing",
        pageKind: "knowledge",
        knowledgeSlug: "cover-song-licensing",
        external: true,
        description: "How cover licenses are handled in Nexo releases.",
      }),
    ],
    [
      item({
        href: "/help/copyrights-takedowns",
        label: "About Copyrights & Takedowns",
        pageKind: "knowledge",
        knowledgeSlug: "copyrights-takedowns",
        external: true,
        description: "Nexo takedown process overview.",
      }),
      item({
        href: "/help/dmca",
        label: "DMCA Process",
        pageKind: "knowledge",
        knowledgeSlug: "dmca",
        external: true,
        description: "How to send a DMCA notice to Nexo.",
      }),
      item({
        href: "/help/trust-and-safety",
        label: "Trust & Safety",
        pageKind: "knowledge",
        knowledgeSlug: "trust-and-safety",
        external: true,
        description: "Trust and safety reporting for Nexo accounts.",
      }),
      item({ href: "/rights/conflict-resolution", label: "Conflict Resolution", pageKind: "service", serviceKind: "conflict_resolution", description: "Submit a catalog, ownership or platform conflict for Nexo review." }),
    ],
  ];
}

function helpGroups(): PortalNavItem[][] {
  return [
    [
      item({
        href: "/support",
        label: "Submit Help Request",
        pageKind: "existing",
        description: "Open a support ticket with Nexo staff.",
      }),
      item({
        href: "/help/knowledge-base",
        label: "Knowledge Base",
        pageKind: "knowledge",
        knowledgeSlug: "knowledge-base",
        external: true,
        description: "Index of Nexo help articles.",
      }),
      item({
        href: "/help/platform-overview",
        label: "Platform Overview",
        pageKind: "knowledge",
        knowledgeSlug: "platform-overview",
        external: true,
        description: "How the Nexo artist and label portals work.",
      }),
      item({
        href: "/help/release-creation",
        label: "Release Creation Guide",
        pageKind: "knowledge",
        knowledgeSlug: "release-creation",
        external: true,
        description: "Step-by-step release creation in Nexo.",
      }),
      item({
        href: "/help/video-tutorials",
        label: "Video Tutorials",
        pageKind: "knowledge",
        knowledgeSlug: "video-tutorials",
        external: true,
        description: "Published Nexo video tutorials only.",
      }),
    ],
  ];
}

export function accountOverlayItems(
  kind: Exclude<WorkspaceKind, "admin">
): PortalNavItem[] {
  return [
    item({
      href: "/account/payment-tax",
      label: "Payment & Tax Details",
      pageKind: "payment-tax",
      description: "Tax profile plus billing. Payment rails stay NOT CONNECTED until a live adapter exists.",
    }),
    item({
      href: "/account/members",
      label: "Account Members",
      pageKind: "members",
      visibility: kind === "label" ? "label" : "all",
      description:
        kind === "label"
          ? "Invite label teammates by email. This does not grant admin access."
          : "Artist accounts are single-user. Label roster management is not available here.",
    }),
    item({
      href: "/account/enrollments",
      label: "Enrollments",
      pageKind: "enrollments",
      description: "Optional Nexo services you can request. Unenrolled until staff confirms.",
    }),
    item({
      href: kind === "label" ? "/account/labels" : "/account/labels",
      label: "Labels",
      pageKind: "labels",
      description:
        kind === "label"
          ? "This label account and roster."
          : "Label accounts linked to you, if any.",
    }),
    item({
      href: "/account/agreements",
      label: "Signed agreements",
      pageKind: "existing",
      description: "View and download all distribution agreements signed on this account.",
    }),
    item({
      href: "/account/preferences",
      label: "Preferences",
      pageKind: "existing",
      description: "Portal and account preferences.",
    }),
    item({
      href: "/dashboard/notifications",
      label: "Notifications",
      pageKind: "existing",
      description: "Account notifications and staff messages.",
    }),
    item({
      href: "/support",
      label: "Support",
      pageKind: "existing",
      description: "Open and track support requests.",
    }),
    item({
      href: "/dashboard/profile",
      label: "My profile",
      pageKind: "existing",
      description: "Name, bio, and DSP profile links.",
    }),
  ];
}

export function portalSectionsForKind(
  kind: Exclude<WorkspaceKind, "admin">
): PortalNavSection[] {
  const defs: { id: string; label: string; groups: PortalNavItem[][]; collapsible?: boolean }[] = [
    { id: "main", label: "Main", groups: mainGroups(), collapsible: false },
    { id: "catalog", label: "Catalog", groups: catalogGroups(kind) },
    { id: "sales", label: "Sales", groups: salesGroups() },
    { id: "analytics", label: "Analytics", groups: analyticsGroups() },
    { id: "reports", label: "Reports", groups: reportsGroups() },
    { id: "marketing", label: "Marketing", groups: marketingGroups() },
    { id: "royalties", label: "Royalties", groups: royaltiesGroups() },
    { id: "splitshare", label: "SplitShare", groups: splitShareGroups() },
    { id: "rights", label: "Rights", groups: rightsGroups() },
    { id: "help", label: "Help", groups: helpGroups() },
  ];
  return defs.map((d) => {
    const groups = d.groups.map((g) =>
      g.filter((it) => !it.visibility || it.visibility === "all" || it.visibility === kind)
    );
    return {
      id: d.id,
      label: d.label,
      collapsible: d.collapsible ?? true,
      groups,
      items: flattenGroups(groups),
    };
  });
}

export function allPortalPageDefs(): PortalNavItem[] {
  const seen = new Set<string>();
  const out: PortalNavItem[] = [];
  for (const kind of ["artist", "label"] as const) {
    for (const section of portalSectionsForKind(kind)) {
      for (const it of section.items) {
        if (seen.has(`${it.href}:${kind}`)) continue;
        seen.add(`${it.href}:${kind}`);
        out.push(it);
      }
    }
    for (const it of accountOverlayItems(kind)) {
      const key = `${it.href}:account:${kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it);
    }
  }
  return out;
}

export function findPortalItem(href: string): PortalNavItem | undefined {
  const artist = portalSectionsForKind("artist");
  const label = portalSectionsForKind("label");
  const account = [...accountOverlayItems("artist"), ...accountOverlayItems("label")];
  return [...artist, ...label].flatMap((s) => s.items).concat(account).find((i) => i.href === href);
}

export function portalPageTitle(href: string): string {
  return findPortalItem(href)?.label ?? "Workspace";
}

export function generatedPortalHrefs(): string[] {
  const hrefs = new Set<string>();
  for (const it of allPortalPageDefs()) {
    if (it.pageKind !== "existing") hrefs.add(it.href);
  }
  return [...hrefs];
}

export const FORBIDDEN_PORTAL_COPY = [
  "SYMPHONIC",
  "SymphonicMS",
  "Get on Symphonic's Playlists",
  "Symphonic",
  "Too Lost",
  "TooLost",
  "toolost",
] as const;
