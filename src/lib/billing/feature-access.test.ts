import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getBillingEntitlements } from "./entitlements";
import {
  hasCatalogMigrationAccess,
  isFeatureUnlocked,
  listPlanFeatures,
  lockedPlanFeatures,
} from "./feature-access";

const artistProSub = {
  userId: "u1",
  accountType: "artist" as const,
  planId: "artist_pro" as const,
  status: "active" as const,
  interval: "month" as const,
  trialEndsAt: null,
  currentPeriodStartsAt: "2026-01-01T00:00:00Z",
  currentPeriodEndsAt: "2026-02-01T00:00:00Z",
  scheduledChangeAction: null,
  scheduledChangeEffectiveAt: null,
  canceledAt: null,
  pausedAt: null,
};

describe("plan feature access from entitlements", () => {
  it("keeps starter/core artist flows available without paid access", () => {
    const e = getBillingEntitlements({ accountType: "artist", subscription: null });
    expect(e.paidAccess).toBe(false);
    expect(isFeatureUnlocked(e, "dashboard")).toBe(true);
    expect(isFeatureUnlocked(e, "catalog")).toBe(true);
    expect(isFeatureUnlocked(e, "releases")).toBe(true);
    expect(isFeatureUnlocked(e, "profile")).toBe(true);
    expect(isFeatureUnlocked(e, "support")).toBe(true);
    expect(isFeatureUnlocked(e, "royalties")).toBe(true);
    expect(isFeatureUnlocked(e, "publishing")).toBe(true);
    expect(hasCatalogMigrationAccess(e)).toBe(false);
    expect(isFeatureUnlocked(e, "player_eligibility")).toBe(false);
    expect(isFeatureUnlocked(e, "advanced_profile")).toBe(false);
    expect(lockedPlanFeatures(e).some((f) => f.id === "catalog_migration")).toBe(true);
  });

  it("unlocks artist Pro-only surfaces only from paidAccess", () => {
    const e = getBillingEntitlements({ accountType: "artist", subscription: artistProSub });
    expect(e.paidAccess).toBe(true);
    expect(hasCatalogMigrationAccess(e)).toBe(true);
    expect(isFeatureUnlocked(e, "player_eligibility")).toBe(true);
    expect(isFeatureUnlocked(e, "priority_support")).toBe(true);
    expect(listPlanFeatures(e).every((f) => f.state === "available")).toBe(true);
  });

  it("grandfathers label core flows and locks label Pro extras until paid label_pro", () => {
    const e = getBillingEntitlements({ accountType: "label", subscription: null });
    expect(e.paidAccess).toBe(false);
    expect(isFeatureUnlocked(e, "roster")).toBe(true);
    expect(isFeatureUnlocked(e, "catalog")).toBe(true);
    expect(isFeatureUnlocked(e, "royalties")).toBe(true);
    expect(isFeatureUnlocked(e, "publishing")).toBe(true);
    expect(isFeatureUnlocked(e, "distribution_management")).toBe(true);
    expect(hasCatalogMigrationAccess(e)).toBe(false);
    expect(isFeatureUnlocked(e, "larger_roster")).toBe(false);
    expect(isFeatureUnlocked(e, "advanced_ops")).toBe(false);
  });

  it("label_starter paid does not unlock label Pro extras", () => {
    const e = getBillingEntitlements({
      accountType: "label",
      subscription: {
        ...artistProSub,
        accountType: "label",
        planId: "label_starter",
      },
    });
    expect(e.paidAccess).toBe(true);
    expect(isFeatureUnlocked(e, "roster")).toBe(true);
    expect(hasCatalogMigrationAccess(e)).toBe(false);
    expect(isFeatureUnlocked(e, "advanced_ops")).toBe(false);
  });

  it("label_pro paid unlocks advanced ops and catalog migration", () => {
    const e = getBillingEntitlements({
      accountType: "label",
      subscription: {
        ...artistProSub,
        accountType: "label",
        planId: "label_pro",
      },
    });
    expect(hasCatalogMigrationAccess(e)).toBe(true);
    expect(isFeatureUnlocked(e, "advanced_ops")).toBe(true);
    expect(lockedPlanFeatures(e)).toEqual([]);
  });

  it("paused subscriptions do not grant Pro-only access", () => {
    const e = getBillingEntitlements({
      accountType: "artist",
      subscription: { ...artistProSub, status: "paused" },
    });
    expect(e.paidAccess).toBe(false);
    expect(e.grandfathered).toBe(true);
    expect(hasCatalogMigrationAccess(e)).toBe(false);
    expect(isFeatureUnlocked(e, "releases")).toBe(true);
  });
});

describe("entitlement UI wiring", () => {
  it("dashboards and move-in use server entitlements, not client paid flags", () => {
    const dashboard = readFileSync(join(process.cwd(), "src/app/(portal)/dashboard/page.tsx"), "utf8");
    expect(dashboard).toContain("PlanFeaturesPanel");
    expect(dashboard).toContain("safeGetEntitlementsForAuth");
    expect(dashboard).not.toMatch(/paidAccess\s*=\s*true/);

    const moveIn = readFileSync(
      join(process.cwd(), "src/app/(portal)/dashboard/catalog/move-in/page.tsx"),
      "utf8"
    );
    expect(moveIn).toContain("hasCatalogMigrationAccess");
    expect(moveIn).toContain("CatalogMigrationLocked");

    const actions = readFileSync(
      join(process.cwd(), "src/app/(portal)/dashboard/catalog/move-in/actions.ts"),
      "utf8"
    );
    expect(actions).toContain("hasCatalogMigrationAccess");
    expect(actions).toContain("verified Pro plan");

    const admin = readFileSync(join(process.cwd(), "src/app/admin/finance/billing/page.tsx"), "utf8");
    expect(admin).toContain("getBillingEntitlements");
    expect(admin).toContain("paidAccess");

    const realtime = readFileSync(
      join(process.cwd(), "src/components/notifications/RealtimeRefresh.tsx"),
      "utf8"
    );
    expect(realtime).toContain("billing_subscriptions");

    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20260915900000_billing_subscriptions_realtime.sql"),
      "utf8"
    );
    expect(sql).toContain("alter publication supabase_realtime add table public.billing_subscriptions");
  });
});
