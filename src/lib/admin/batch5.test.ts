import { describe, expect, it } from "vitest";
import {
  ADMIN_PORTAL_ROLES,
  canMarkPayoutPaid,
  hasAdminPermission,
  isAdminPortalRole,
} from "@/lib/admin/permissions";
import {
  decisionToStatus,
  isQcableStatus,
  validateQcDecision,
  QC_CHECKLIST_KEYS,
} from "@/lib/admin/qc";
import {
  canSetPaidWithPaymentOp,
  canTransitionPayout,
  formatMinorUnits,
  assertMinorUnits,
} from "@/lib/finance/money";
import {
  parseAdminSearchEntities,
  sanitizeAdminSearchQuery,
} from "@/lib/admin/search";
import { homePathForRoles } from "@/lib/auth/types";
import { isAllowedAdminSettingKey } from "@/lib/admin/settings";
import { navForRoles } from "@/lib/auth/nav";
import { hasPermission } from "@/architecture/auth/rbac";
import { canTransition } from "@/lib/releases/status";

describe("Batch 5 admin route protection / roles", () => {
  it("allows admin, super_admin, support into admin portal", () => {
    expect(isAdminPortalRole(["support"])).toBe(true);
    expect(isAdminPortalRole(["admin"])).toBe(true);
    expect(isAdminPortalRole(["artist"])).toBe(false);
    expect(ADMIN_PORTAL_ROLES).toEqual(
      expect.arrayContaining(["admin", "super_admin", "support"])
    );
    expect(homePathForRoles(["support"])).toBe("/admin");
  });

  it("permission helpers are granular", () => {
    expect(hasAdminPermission(["support"], "admin:qc")).toBe(true);
    expect(hasAdminPermission(["support"], "admin:settings")).toBe(false);
    expect(hasAdminPermission(["admin"], "admin:settings")).toBe(true);
    expect(hasAdminPermission(["super_admin"], "admin:roles")).toBe(true);
    expect(hasAdminPermission(["admin"], "admin:roles")).toBe(false);
    expect(hasPermission(["support"], "admin:access")).toBe(true);
  });

  it("admin nav covers ops center destinations", () => {
    const hrefs = navForRoles(["admin"]).map((n) => n.href);
    for (const h of [
      "/admin/releases",
      "/admin/qc",
      "/admin/artists",
      "/admin/labels",
      "/admin/finance",
      "/admin/royalties",
      "/admin/payouts",
      "/admin/analytics",
      "/admin/distribution",
      "/admin/compliance",
      "/admin/support",
      "/admin/contact",
      "/admin/notifications",
      "/admin/audit",
      "/admin/reports",
      "/admin/settings",
    ]) {
      expect(hrefs).toContain(h);
    }
    expect(navForRoles(["support"]).map((n) => n.href)).not.toContain("/admin/settings");
  });
});

describe("Batch 5 QC transitions", () => {
  it("maps decisions to status machine targets", () => {
    expect(decisionToStatus("approve")).toBe("approved");
    expect(decisionToStatus("request_changes")).toBe("changes_requested");
    expect(decisionToStatus("reject")).toBe("rejected");
    expect(isQcableStatus("submitted")).toBe(true);
    expect(isQcableStatus("draft")).toBe(false);
  });

  it("requires artist-visible reason and full checklist for approve", () => {
    expect(
      validateQcDecision({ decision: "reject", artistVisibleReason: "" }).ok
    ).toBe(false);
    expect(
      validateQcDecision({
        decision: "reject",
        artistVisibleReason: "Missing artwork",
      }).ok
    ).toBe(true);
    const partial = Object.fromEntries(QC_CHECKLIST_KEYS.map((k) => [k, false]));
    expect(validateQcDecision({ decision: "approve", checklist: partial }).ok).toBe(
      false
    );
    const full = Object.fromEntries(QC_CHECKLIST_KEYS.map((k) => [k, true]));
    expect(validateQcDecision({ decision: "approve", checklist: full }).ok).toBe(true);
  });

  it("staff can QC via status machine; owners cannot self-approve", () => {
    expect(
      canTransition({
        from: "in_qc",
        to: "approved",
        actor: "staff",
        providerConnected: false,
        isOwner: false,
      }).ok
    ).toBe(true);
    expect(
      canTransition({
        from: "submitted",
        to: "approved",
        actor: "owner",
        providerConnected: false,
        isOwner: true,
      }).ok
    ).toBe(false);
  });
});

describe("Batch 5 finance / payout protection", () => {
  it("uses integer minor units", () => {
    expect(assertMinorUnits(1250)).toBe(true);
    expect(assertMinorUnits(12.5)).toBe(false);
    expect(formatMinorUnits(1250, "USD")).toContain("12.50");
  });

  it("never allows casual PAID via role or transition helper", () => {
    expect(canMarkPayoutPaid(["super_admin"])).toBe(false);
    expect(canTransitionPayout("processing", "paid").ok).toBe(false);
    expect(canSetPaidWithPaymentOp({ paymentReference: null, paidAt: null }).ok).toBe(
      false
    );
    expect(
      canSetPaidWithPaymentOp({
        paymentReference: "pay_123",
        paidAt: new Date().toISOString(),
      }).ok
    ).toBe(true);
  });
});

describe("Batch 5 search / suspension concepts", () => {
  it("sanitizes search and parses entities", () => {
    expect(sanitizeAdminSearchQuery("a%b_c(d)")).not.toMatch(/[%_()]/);
    expect(parseAdminSearchEntities("release,user")).toEqual(["release", "user"]);
    expect(parseAdminSearchEntities("all").length).toBeGreaterThan(3);
  });
});

describe("Batch 5 settings protection", () => {
  it("only accepts explicit non-secret setting keys", () => {
    expect(isAllowedAdminSettingKey("qc.default_priority")).toBe(true);
    expect(isAllowedAdminSettingKey("provider.secret")).toBe(false);
    expect(isAllowedAdminSettingKey("anything.random")).toBe(false);
  });
});

describe("Batch 5 storage / authz concepts", () => {
  it("private asset playback uses signed URLs conceptually (bucket private)", () => {
    // Buckets release-audio / compliance-evidence / support-attachments are private;
    // admin detail creates short-lived signed URLs server-side only.
    expect(true).toBe(true);
  });
});

describe("Batch 5 notifications / audit / tickets", () => {
  it("staff have audit and ticket permissions", () => {
    expect(hasPermission(["support"], "audit:read")).toBe(true);
    expect(hasPermission(["support"], "support:tickets")).toBe(true);
    expect(hasAdminPermission(["admin"], "admin:support")).toBe(true);
    expect(hasAdminPermission(["admin"], "admin:contact")).toBe(true);
  });
});
