import type { AppRole } from "@/lib/auth/types";

export const ADMIN_PERMISSION_VALUES = [
  "admin:access",
  "admin:dashboard",
  "admin:operations",
  "admin:directory",
  "admin:releases",
  "admin:qc",
  "admin:artists",
  "admin:labels",
  "admin:users",
  "admin:staff_invite",
  "admin:finance",
  "admin:billing_tools",
  "admin:royalties",
  "admin:splitshare",
  "admin:payouts",
  "admin:publishing",
  "admin:statements",
  "admin:analytics",
  "admin:distribution",
  "admin:ddex",
  "admin:marketing",
  "admin:compliance",
  "admin:support",
  "admin:contact",
  "admin:newsletter",
  "admin:emails",
  "admin:notifications",
  "admin:website",
  "admin:audit",
  "admin:reports",
  "admin:settings",
  "admin:search",
  "admin:roles",
  "admin:payouts:mark_paid",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSION_VALUES)[number];

const ADMIN_PERMISSION_SET = new Set<string>(ADMIN_PERMISSION_VALUES);

export function isAdminPermission(value: unknown): value is AdminPermission {
  return typeof value === "string" && ADMIN_PERMISSION_SET.has(value);
}

/**
 * The base support role is only a staff-portal identity gate.
 * Functional permissions come from staff_role_assignments in Supabase.
 */
const SUPPORT_BASE_PERMS: AdminPermission[] = [
  "admin:access",
  "admin:dashboard",
];

/** Full day-to-day administration, excluding Super Admin role mutation. */
const ADMIN_PERMS: AdminPermission[] = ADMIN_PERMISSION_VALUES.filter(
  (permission) =>
    permission !== "admin:roles" &&
    permission !== "admin:payouts:mark_paid"
);

const ROLE_ADMIN_PERMS: Record<AppRole, AdminPermission[]> = {
  public_user: [],
  artist: [],
  label: [],
  support: SUPPORT_BASE_PERMS,
  admin: ADMIN_PERMS,
  super_admin: [...ADMIN_PERMS, "admin:roles"],
};

export const ADMIN_PORTAL_ROLES: AppRole[] = ["admin", "super_admin", "support"];

export function isAdminPortalRole(roles: AppRole[]): boolean {
  return roles.some((r) => ADMIN_PORTAL_ROLES.includes(r));
}

export function adminPermissionsForRoles(roles: AppRole[]): Set<AdminPermission> {
  const set = new Set<AdminPermission>();
  for (const role of roles) {
    for (const p of ROLE_ADMIN_PERMS[role] ?? []) set.add(p);
  }
  return set;
}

/**
 * Static role check. Use getEffectiveAdminPermissions/RequireAdminPermission
 * for support users because their functional permissions live in Supabase.
 */
export function hasAdminPermission(roles: AppRole[], permission: AdminPermission): boolean {
  return adminPermissionsForRoles(roles).has(permission);
}

export function permissionSetHas(
  permissions: ReadonlySet<AdminPermission>,
  permission: AdminPermission
): boolean {
  return permissions.has(permission);
}

/**
 * Canonical route -> permission map. Middleware and navigation both consume it,
 * preventing menu hiding from becoming the only authorization layer.
 */
const ADMIN_PATH_PERMISSIONS: Array<{
  prefix: string;
  permission: AdminPermission;
}> = [
  { prefix: "/admin/tools/billing", permission: "admin:billing_tools" },
  { prefix: "/admin/finance/billing", permission: "admin:billing_tools" },
  { prefix: "/admin/distribution/stores", permission: "admin:distribution" },
  { prefix: "/admin/work-queue", permission: "admin:operations" },
  { prefix: "/admin/operations", permission: "admin:operations" },
  { prefix: "/admin/rights", permission: "admin:compliance" },
  { prefix: "/admin/fraud", permission: "admin:compliance" },
  { prefix: "/admin/conflicts", permission: "admin:compliance" },
  { prefix: "/admin/privacy", permission: "admin:compliance" },
  { prefix: "/admin/system-health", permission: "admin:operations" },
  { prefix: "/admin/approvals", permission: "admin:operations" },
  { prefix: "/admin/security", permission: "admin:users" },
  { prefix: "/admin/email-deliverability", permission: "admin:emails" },
  { prefix: "/admin/tax-compliance", permission: "admin:finance" },
  { prefix: "/admin/broadcasts", permission: "admin:notifications" },
  { prefix: "/admin/contracts", permission: "admin:compliance" },
  { prefix: "/admin/feature-flags", permission: "admin:settings" },
  { prefix: "/admin/audit/intelligence", permission: "admin:audit" },
  { prefix: "/admin/releases", permission: "admin:releases" },
  { prefix: "/admin/qc", permission: "admin:qc" },
  { prefix: "/admin/artists", permission: "admin:artists" },
  { prefix: "/admin/labels", permission: "admin:labels" },
  { prefix: "/admin/users", permission: "admin:users" },
  { prefix: "/admin/roles", permission: "admin:staff_invite" },
  { prefix: "/admin/verifications", permission: "admin:compliance" },
  { prefix: "/admin/agreements", permission: "admin:compliance" },
  { prefix: "/admin/distribution", permission: "admin:distribution" },
  { prefix: "/admin/ddex", permission: "admin:ddex" },
  { prefix: "/admin/playlist-pitches", permission: "admin:marketing" },
  { prefix: "/admin/marketing", permission: "admin:marketing" },
  { prefix: "/admin/portal-requests", permission: "admin:support" },
  { prefix: "/admin/publishing", permission: "admin:publishing" },
  { prefix: "/admin/finance", permission: "admin:finance" },
  { prefix: "/admin/royalties", permission: "admin:royalties" },
  { prefix: "/admin/splitshare", permission: "admin:splitshare" },
  { prefix: "/admin/statements", permission: "admin:statements" },
  { prefix: "/admin/payouts", permission: "admin:payouts" },
  { prefix: "/admin/analytics", permission: "admin:analytics" },
  { prefix: "/admin/support", permission: "admin:support" },
  { prefix: "/admin/notifications", permission: "admin:notifications" },
  { prefix: "/admin/emails", permission: "admin:emails" },
  { prefix: "/admin/contact", permission: "admin:contact" },
  { prefix: "/admin/newsletter", permission: "admin:newsletter" },
  { prefix: "/admin/website", permission: "admin:website" },
  { prefix: "/admin/partners", permission: "admin:website" },
  { prefix: "/admin/blog", permission: "admin:website" },
  { prefix: "/admin/pages", permission: "admin:website" },
  { prefix: "/admin/videos", permission: "admin:website" },
  { prefix: "/admin/compliance", permission: "admin:compliance" },
  { prefix: "/admin/search", permission: "admin:search" },
  { prefix: "/admin/reports", permission: "admin:reports" },
  { prefix: "/admin/audit", permission: "admin:audit" },
  { prefix: "/admin/settings", permission: "admin:settings" },
];

export function adminPermissionForPath(pathname: string): AdminPermission | null {
  const clean = pathname.split("?")[0] || pathname;
  if (clean === "/admin") return "admin:dashboard";

  for (const { prefix, permission } of ADMIN_PATH_PERMISSIONS) {
    if (clean === prefix || clean.startsWith(`${prefix}/`)) return permission;
  }

  if (clean.startsWith("/admin/")) return "admin:operations";
  return null;
}

/** Marking payout PAID is never granted via role alone — requires real payment op. */
export function canMarkPayoutPaid(roles: AppRole[]): boolean {
  void roles;
  return false;
}

export const ADMINISTRATOR_ROLES: AppRole[] = ["admin", "super_admin"];

export function isAdministratorRole(roles: AppRole[]): boolean {
  return roles.some((r) => ADMINISTRATOR_ROLES.includes(r));
}

export function evaluateAdministratorLogin(roles: AppRole[]): {
  ok: boolean;
  message?: string;
} {
  if (isAdministratorRole(roles)) return { ok: true };
  return {
    ok: false,
    message:
      "This account does not have administrator access. Staff who use the standard portal can sign in from the main login page.",
  };
}
