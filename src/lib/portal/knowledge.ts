export type KnowledgeArticle = {
  slug: string;
  title: string;
  summary: string;
  sections: { heading: string; body: string }[];
};

const ARTICLES: KnowledgeArticle[] = [
  {
    slug: "marketing-best-practices",
    title: "Marketing Best Practices",
    summary: "Practical release marketing on Nexo — no invented chart claims.",
    sections: [
      {
        heading: "Before release day",
        body: "Finish metadata, artwork, and DSP profile links (Spotify, Apple Music, Audiomack, and others) on your artist profile. Enabled links are snapshotted onto the release for targeting. They are profile URLs, not commercial API connections.",
      },
      {
        heading: "Pitching",
        body: "Use Playlist pitching for Nexo-reviewed playlists and DSP Pitching for editorial consideration. Staff review every request. Acceptance is not automatic and does not place you on a store playlist by itself.",
      },
      {
        heading: "Paid ads",
        body: "Nexo Ad Box is a request for creative support. Spend is never started until you confirm a budget with staff. Do not assume impressions or conversions.",
      },
    ],
  },
  {
    slug: "client-offerings",
    title: "Client Offerings",
    summary: "Optional Nexo marketing and catalog services you can request from this portal.",
    sections: [
      {
        heading: "Included with distribution",
        body: "Release delivery, QC, catalog, royalties ledger, and support tickets are part of an active Nexo account on a paid or eligible plan.",
      },
      {
        heading: "Request-only",
        body: "Sync representation, physical, Ad Box, influencers, Luminate registration, and Nexo Labs are request queues. They stay pending until staff confirms. Nothing here is a third-party brand partnership unless Nexo writes that in your request status.",
      },
    ],
  },
  {
    slug: "royalties-help",
    title: "Royalties Help",
    summary: "How Nexo shows earnings, statements, and payouts.",
    sections: [
      {
        heading: "Balances",
        body: "Available, pending, and paid amounts come from the royalty ledger. Empty means no posted lines yet — not zero estimated streams.",
      },
      {
        heading: "Requesting payment",
        body: "Request Payment creates a payout request from your available balance. Nexo does not mark a payment provider CONNECTED unless a live adapter is registered. Staff review requests before any transfer.",
      },
      {
        heading: "Splits",
        body: "SplitShare rules must total 100%. Historical rules used in posted ledger lines are not rewritten in place.",
      },
    ],
  },
  {
    slug: "splitshare-guide",
    title: "SplitShare Quick Start",
    summary: "Splits, payees, track assignments, and recoupments.",
    sections: [
      {
        heading: "1. Add payees",
        body: "Add each person or company with the email that should receive their share. Admin review links matching Nexo accounts automatically; external payees can still accrue a protected held balance until they are linked.",
      },
      {
        heading: "2. Create a split",
        body: "Create the rule from approved payees and make the percentages total exactly 100%. The rule remains inactive until admin approval, so an unreviewed split cannot change royalty posting.",
      },
      {
        heading: "3. Assign to tracks",
        body: "Attach an approved rule to a track you own and submit it for review. After approval, future posted royalty rows for that track are allocated through SplitShare; already-posted ledger lines stay immutable.",
      },
      {
        heading: "4. Recoupments",
        body: "Submit a real agreed advance or recoupable cost against a payee, optionally scoped to one track. Once approved, recovery is deducted from that payee’s future SplitShare allocations and the recovered balance updates from real posted royalty rows.",
      },
    ],
  },
  {
    slug: "youtube-oac",
    title: "YouTube Official Artist Channel",
    summary: "How Nexo handles Official Artist Channel (OAC) requests.",
    sections: [
      {
        heading: "What Nexo can do",
        body: "Staff can help package an OAC request when your catalog and artist identity are complete. YouTube makes the final decision. Nexo cannot mark an OAC as connected without YouTube confirmation.",
      },
      {
        heading: "What to prepare",
        body: "Official artist name, YouTube channel URL, and matching DSP profile links. Open a help request if your channel is already topic-only.",
      },
    ],
  },
  {
    slug: "copyright-your-music",
    title: "Copyright Your Music",
    summary: "Copyright basics for Nexo clients. This is not legal advice.",
    sections: [
      {
        heading: "Ownership",
        body: "You represent that you own or control the rights you deliver. Nexo distributes what you submit; we do not file copyright registrations for you unless a separate service request is accepted.",
      },
      {
        heading: "Registration",
        body: "If you need a registration filing, submit a help request with territory and work details. Status stays pending until staff confirms.",
      },
    ],
  },
  {
    slug: "cover-song-licensing",
    title: "Cover Song Licensing",
    summary: "Cover recordings on Nexo releases.",
    sections: [
      {
        heading: "Mechanical licenses",
        body: "Cover recordings may require mechanical licensing in the territories you target. Mark covers accurately in the release wizard. Nexo will not invent a license number.",
      },
      {
        heading: "Need help",
        body: "Open a help request with the original work title, writers, and territories. Do not deliver a cover as an original.",
      },
    ],
  },
  {
    slug: "copyrights-takedowns",
    title: "About Copyrights & Takedowns",
    summary: "How Nexo handles alleged infringement.",
    sections: [
      {
        heading: "If someone copied you",
        body: "Use YouTube / TikTok / SoundCloud / Meta claim pages in Rights, or submit a help request with URLs and ownership proof.",
      },
      {
        heading: "If you received a claim",
        body: "Do not ignore it. Reply in Messages with the release UPC/ISRC and your position. Staff will not auto-dispute without your instruction.",
      },
    ],
  },
  {
    slug: "dmca",
    title: "DMCA Process",
    summary: "Sending a DMCA notice to NEXO MUSIC DISTRIBUTION LTD.",
    sections: [
      {
        heading: "Where to send",
        body: "Email contact@nexomusicdistro.space with subject “DMCA”. Include the work, URLs, your contact details, and a good-faith statement. Additional inquiries: nexomusicdistribution@gmail.com.",
      },
      {
        heading: "What happens next",
        body: "Staff log the notice and may pause related catalog items while reviewing. Counter-notices are handled as written requests — nothing is auto-restored.",
      },
    ],
  },
  {
    slug: "trust-and-safety",
    title: "Trust & Safety",
    summary: "Report abuse, impersonation, or unsafe content on Nexo.",
    sections: [
      {
        heading: "Report",
        body: "Submit a help request with URLs, account names, and what happened. Do not send malware files.",
      },
      {
        heading: "Account action",
        body: "Nexo may restrict or suspend accounts that violate terms. You will see status on login — we do not silently invent a ban reason.",
      },
    ],
  },
  {
    slug: "knowledge-base",
    title: "Knowledge Base",
    summary: "Nexo help index inside this portal.",
    sections: [
      {
        heading: "Catalog",
        body: "Create Release, Transfer Track (move-in), music videos, ringtone and mastering requests.",
      },
      {
        heading: "Money",
        body: "Royalty Summary, Request Payment, SplitShare, publishing works.",
      },
      {
        heading: "Rights",
        body: "Allowlists and manual claims are request queues. DSP dashboards stay empty until statement ingest exists.",
      },
    ],
  },
  {
    slug: "platform-overview",
    title: "Platform Overview",
    summary: "Artist and Label workspaces at NEXO MUSIC DISTRIBUTION LTD.",
    sections: [
      {
        heading: "Artist",
        body: "You manage your own catalog, profile, DSP links, pitching, royalties, and support. You do not manage a label roster.",
      },
      {
        heading: "Label",
        body: "You manage a roster of artist profiles (no extra logins), catalog, members, and the same distribution tools. Creating an artist does not convert the label account.",
      },
      {
        heading: "Admin",
        body: "Staff use a separate operations console. This overlay is for artist and label accounts only.",
      },
    ],
  },
  {
    slug: "release-creation",
    title: "Release Creation Guide",
    summary: "Create a release in the Nexo portal.",
    sections: [
      {
        heading: "Start",
        body: "Catalog → Create Release. Choose single, EP, or album. Labels pick a roster artist.",
      },
      {
        heading: "Assets",
        body: "Upload audio and artwork. QC must pass before delivery. Listener counts stay empty until real statements are ingested.",
      },
      {
        heading: "DSP targeting",
        body: "Enable profile URLs on the artist (Spotify, Apple Music, Audiomack, and others). Submit snapshots those links onto the release. That is metadata, not a CONNECTED DSP badge.",
      },
    ],
  },
  {
    slug: "video-tutorials",
    title: "Video Tutorials",
    summary: "Published Nexo tutorials only — no placeholder videos.",
    sections: [
      {
        heading: "Where they appear",
        body: "When Nexo publishes a tutorial, it is listed on the public Videos page and linked here. If this list is empty, none are published yet.",
      },
    ],
  },
];

const BY_SLUG = new Map(ARTICLES.map((a) => [a.slug, a]));

export function knowledgeArticle(slug: string): KnowledgeArticle | undefined {
  return BY_SLUG.get(slug);
}

export function allKnowledgeArticles(): KnowledgeArticle[] {
  return ARTICLES;
}
