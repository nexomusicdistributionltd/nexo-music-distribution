import type { BillingEntitlements } from "./entitlements";
import type { BillingAccountType, PaidTierId, TierId } from "./plans";

/**
 * Plan feature catalog for dashboards.
 * Access is derived from getBillingEntitlements() — not a second entitlement system.
 *
 * Soft-gate policy:
 * - Core workspace flows stay available (grandfathered) without a Paddle subscription.
 * - Clearly Pro-only surfaces stay locked until webhook-synced paidAccess.
 */

export type PlanFeatureId =
  | "dashboard"
  | "catalog"
  | "profile"
  | "releases"
  | "support"
  | "advanced_releases"
  | "royalties"
  | "publishing"
  | "catalog_migration"
  | "priority_support"
  | "player_eligibility"
  | "advanced_profile"
  | "roster"
  | "distribution_management"
  | "larger_roster"
  | "advanced_catalog"
  | "advanced_royalty"
  | "advanced_publishing"
  | "advanced_ops";

export type FeatureUnlockReason = "included" | "grandfathered" | "paid";
export type FeatureLockReason = "upgrade";
export type PlanFeatureState = "available" | "locked";

export type PlanFeature = {
  id: PlanFeatureId;
  label: string;
  description: string;
  href?: string;
  requiredPlan: TierId;
  state: PlanFeatureState;
  reason: FeatureUnlockReason | FeatureLockReason;
};

const ARTIST_FEATURES: Omit<PlanFeature, "state" | "reason">[] = [
  {
    id: "dashboard",
    label: "Artist dashboard",
    description: "Overview of catalog, QC, and account activity.",
    href: "/dashboard",
    requiredPlan: "artist_starter",
  },
  {
    id: "catalog",
    label: "Catalog",
    description: "Browse and manage your releases.",
    href: "/dashboard/catalog",
    requiredPlan: "artist_starter",
  },
  {
    id: "profile",
    label: "Profile",
    description: "Account name, country, and avatar.",
    href: "/dashboard/profile",
    requiredPlan: "artist_starter",
  },
  {
    id: "releases",
    label: "Release tools",
    description: "Create and submit releases through QC.",
    href: "/dashboard/releases/new",
    requiredPlan: "artist_starter",
  },
  {
    id: "support",
    label: "Support",
    description: "Message Nexo support from your inbox.",
    href: "/support",
    requiredPlan: "artist_starter",
  },
  {
    id: "royalties",
    label: "Royalties",
    description: "Ledger balances and statements. Remains available during the plan transition.",
    href: "/earnings",
    requiredPlan: "artist_pro",
  },
  {
    id: "publishing",
    label: "Publishing",
    description: "Publishing works. Remains available during the plan transition.",
    href: "/app/publishing",
    requiredPlan: "artist_pro",
  },
  {
    id: "advanced_releases",
    label: "Advanced releases",
    description: "Priority handling and advanced release operations.",
    href: "/dashboard/releases",
    requiredPlan: "artist_pro",
  },
  {
    id: "catalog_migration",
    label: "Catalog migration",
    description: "Move In existing catalog from another distributor.",
    href: "/dashboard/catalog/move-in",
    requiredPlan: "artist_pro",
  },
  {
    id: "priority_support",
    label: "Priority support",
    description: "Priority queue for support tickets.",
    href: "/support",
    requiredPlan: "artist_pro",
  },
  {
    id: "player_eligibility",
    label: "Nexo player eligibility",
    description: "Eligible for website playback on the Nexo player.",
    requiredPlan: "artist_pro",
  },
  {
    id: "advanced_profile",
    label: "Advanced profile",
    description: "Extended public artist profile and website controls.",
    href: "/dashboard/profile",
    requiredPlan: "artist_pro",
  },
];

const LABEL_FEATURES: Omit<PlanFeature, "state" | "reason">[] = [
  {
    id: "dashboard",
    label: "Label dashboard",
    description: "Roster, catalog, and distribution overview.",
    href: "/dashboard",
    requiredPlan: "label_starter",
  },
  {
    id: "roster",
    label: "Roster",
    description: "Managed artist profiles for this label.",
    href: "/app/artists",
    requiredPlan: "label_starter",
  },
  {
    id: "catalog",
    label: "Catalog",
    description: "Label catalog and release tools.",
    href: "/dashboard/catalog",
    requiredPlan: "label_starter",
  },
  {
    id: "releases",
    label: "Distribution management",
    description: "Create and submit roster releases.",
    href: "/dashboard/releases/new",
    requiredPlan: "label_starter",
  },
  {
    id: "distribution_management",
    label: "Distribution workflow",
    description: "QC and distribution status for roster releases.",
    href: "/dashboard/releases",
    requiredPlan: "label_starter",
  },
  {
    id: "royalties",
    label: "Royalties",
    description: "Label royalty ledger and statements.",
    href: "/earnings",
    requiredPlan: "label_starter",
  },
  {
    id: "publishing",
    label: "Publishing",
    description: "Publishing works for the label catalog.",
    href: "/app/publishing",
    requiredPlan: "label_starter",
  },
  {
    id: "support",
    label: "Support",
    description: "Message Nexo support from your inbox.",
    href: "/support",
    requiredPlan: "label_starter",
  },
  {
    id: "profile",
    label: "Label profile",
    description: "Label account details.",
    href: "/dashboard/profile",
    requiredPlan: "label_starter",
  },
  {
    id: "catalog_migration",
    label: "Advanced catalog migration",
    description: "Move In catalog from another distributor.",
    href: "/dashboard/catalog/move-in",
    requiredPlan: "label_pro",
  },
  {
    id: "larger_roster",
    label: "Larger roster",
    description: "Higher-volume roster operations.",
    href: "/app/artists",
    requiredPlan: "label_pro",
  },
  {
    id: "advanced_catalog",
    label: "Advanced catalog",
    description: "Advanced catalog tooling for high-volume labels.",
    href: "/dashboard/catalog",
    requiredPlan: "label_pro",
  },
  {
    id: "advanced_royalty",
    label: "Advanced royalties",
    description: "Advanced royalty operations.",
    href: "/earnings",
    requiredPlan: "label_pro",
  },
  {
    id: "advanced_publishing",
    label: "Advanced publishing",
    description: "Advanced publishing operations.",
    href: "/app/publishing",
    requiredPlan: "label_pro",
  },
  {
    id: "priority_support",
    label: "Priority support",
    description: "Priority queue for support tickets.",
    href: "/support",
    requiredPlan: "label_pro",
  },
  {
    id: "advanced_ops",
    label: "Advanced operations",
    description: "Priority operational handling as capacity allows.",
    requiredPlan: "label_pro",
  },
];

/** Existing core flows — remain available without Paddle (grandfather / starter). */
const ARTIST_CORE = new Set<PlanFeatureId>([
  "dashboard",
  "catalog",
  "profile",
  "releases",
  "support",
]);

/** Already used in production; keep available during transition even though listed on Pro. */
const ARTIST_GRANDFATHER = new Set<PlanFeatureId>(["royalties", "publishing"]);

const ARTIST_PRO_ONLY = new Set<PlanFeatureId>([
  "advanced_releases",
  "catalog_migration",
  "priority_support",
  "player_eligibility",
  "advanced_profile",
]);

const LABEL_CORE = new Set<PlanFeatureId>([
  "dashboard",
  "roster",
  "catalog",
  "releases",
  "distribution_management",
  "royalties",
  "publishing",
  "support",
  "profile",
]);

const LABEL_PRO_ONLY = new Set<PlanFeatureId>([
  "catalog_migration",
  "larger_roster",
  "advanced_catalog",
  "advanced_royalty",
  "advanced_publishing",
  "priority_support",
  "advanced_ops",
]);

function paidPlanId(entitlements: BillingEntitlements): PaidTierId | null {
  if (!entitlements.paidAccess) return null;
  const id = entitlements.planId;
  if (id === "artist_pro" || id === "label_starter" || id === "label_pro") return id;
  return null;
}

function resolveArtistFeature(
  feature: Omit<PlanFeature, "state" | "reason">,
  entitlements: BillingEntitlements
): PlanFeature {
  const paid = paidPlanId(entitlements);
  if (ARTIST_CORE.has(feature.id)) {
    return { ...feature, state: "available", reason: paid === "artist_pro" ? "paid" : "included" };
  }
  if (ARTIST_GRANDFATHER.has(feature.id)) {
    if (paid === "artist_pro") return { ...feature, state: "available", reason: "paid" };
    return { ...feature, state: "available", reason: "grandfathered" };
  }
  if (ARTIST_PRO_ONLY.has(feature.id)) {
    if (paid === "artist_pro") return { ...feature, state: "available", reason: "paid" };
    return { ...feature, state: "locked", reason: "upgrade" };
  }
  return { ...feature, state: "locked", reason: "upgrade" };
}

function resolveLabelFeature(
  feature: Omit<PlanFeature, "state" | "reason">,
  entitlements: BillingEntitlements
): PlanFeature {
  const paid = paidPlanId(entitlements);
  if (LABEL_CORE.has(feature.id)) {
    if (paid === "label_starter" || paid === "label_pro") {
      return { ...feature, state: "available", reason: "paid" };
    }
    return { ...feature, state: "available", reason: "grandfathered" };
  }
  if (LABEL_PRO_ONLY.has(feature.id)) {
    if (paid === "label_pro") return { ...feature, state: "available", reason: "paid" };
    return { ...feature, state: "locked", reason: "upgrade" };
  }
  return { ...feature, state: "locked", reason: "upgrade" };
}

export function listPlanFeatures(entitlements: BillingEntitlements): PlanFeature[] {
  const account: BillingAccountType | null = entitlements.accountType;
  if (account === "label") {
    return LABEL_FEATURES.map((f) => resolveLabelFeature(f, entitlements));
  }
  return ARTIST_FEATURES.map((f) => resolveArtistFeature(f, entitlements));
}

export function isFeatureUnlocked(
  entitlements: BillingEntitlements,
  featureId: PlanFeatureId
): boolean {
  return listPlanFeatures(entitlements).some((f) => f.id === featureId && f.state === "available");
}

/** Catalog Move In is Pro-only. Never grant from the client. */
export function hasCatalogMigrationAccess(entitlements: BillingEntitlements): boolean {
  return isFeatureUnlocked(entitlements, "catalog_migration");
}

export function catalogMigrationUpgradePlan(
  accountType: BillingAccountType | null
): PaidTierId {
  return accountType === "label" ? "label_pro" : "artist_pro";
}

export function availablePlanFeatures(entitlements: BillingEntitlements): PlanFeature[] {
  return listPlanFeatures(entitlements).filter((f) => f.state === "available");
}

export function lockedPlanFeatures(entitlements: BillingEntitlements): PlanFeature[] {
  return listPlanFeatures(entitlements).filter((f) => f.state === "locked");
}

export function pricingHrefForAccount(accountType: BillingAccountType | null): string {
  return `/pricing?type=${accountType === "label" ? "label" : "artist"}`;
}
