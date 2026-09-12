/**
 * Module boundaries for future expansion.
 * Batch 1 defines ownership only — no implementations.
 */

export const MODULES = {
  publicSite: {
    id: "public-site",
    description: "Marketing pages, SEO, public education content",
    owns: ["navbar", "footer", "home", "pricing", "about", "services"],
  },
  artistPortal: {
    id: "artist-portal",
    description: "Artist catalog, releases, earnings views",
    owns: ["portal/releases", "portal/profile", "portal/royalties"],
  },
  labelPortal: {
    id: "label-portal",
    description: "Multi-artist label management",
    owns: ["portal/roster", "portal/label-settings"],
  },
  admin: {
    id: "admin",
    description: "Internal ops, QC, user administration",
    owns: ["admin/users", "admin/qc", "admin/audit"],
  },
  publishing: {
    id: "publishing",
    description: "Nexo Publishing Group — works, rights, splits",
    owns: ["publishing/works", "publishing/rights", "publishing/splits"],
  },
  distributionEngine: {
    id: "distribution-engine",
    description: "Provider adapters, delivery pipeline, takedowns",
    owns: ["architecture/distribution", "dsp_deliveries"],
  },
  royaltyEngine: {
    id: "royalty-engine",
    description: "Statements, transactions, payouts",
    owns: ["royalties", "royalty_transactions", "payouts"],
  },
  notifications: {
    id: "notifications",
    description: "In-app and email notifications",
    owns: ["notifications"],
  },
  support: {
    id: "support",
    description: "Support tickets and helpdesk",
    owns: ["support_tickets"],
  },
  externalApi: {
    id: "external-api",
    description: "Partner-facing API (future)",
    owns: ["api/v1"],
  },
} as const;

export type ModuleId = (typeof MODULES)[keyof typeof MODULES]["id"];
