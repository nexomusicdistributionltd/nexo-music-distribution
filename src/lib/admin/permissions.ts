import type { AppRole } from "@/lib/auth/types";

/**
 * Server-enforced permissions for the Nexo admin portal.
 *
 * Keep these permissions independent from the database role enum. The database
 * intentionally stays on support/admin/super_admin while this layer controls
 * what each staff class can actually see and do.
 */
export type AdminPermission =
  | "admin:access"
  | "admin:dashboard"
  | "admin:operations"
  | "admin:releases"
  | "admin:qc"
  | "admin:artists"
  | "admin:labels"
  | "admin:users"
  | "admin:staff_invite"
  | "admin:finance"
  | "admin:royalties"
  | "admin:payouts"
  | "admin:publishing"
  | "admin:statements"
  | "admin:analytics"
  | "admin:distribution"
  | "admin:ddex"
  | "admin:compliance"
  | "admin:support"
  | "admin:contact"
  | "admin:newsletter"
  | "admin:emails"
  | "admin:notifications"
  | "admin:website"
  | "admin:audit"
  | "admin:reports"
  | "admin:settings"
  | "admin:search"
  | "admin:roles" // super_admin only
  | "admin:payouts:mark_paid"; // blocked without real payment op

/**
 * Support is deliberately least-privilege. It can work tickets and the catalog
 * review queue, but it cannot read finance/royalties, operate TooLost delivery,
 * change settings, manage staff, or access privileged operations.
 */
const SUPPORT_PERMS: AdminPermission[] = [
  "admin:access",
  "admin:dashboard",
  "admin:releases",
  "admin:qc",
  "admin:artists",
  "admin:labels",
  "admin:support",
  "admin:contact",
  "admin:notifications",
  "admin:search",
];

/** Full day-to-day administration, excluding super-admin role mutation. */
const ADMIN_PERMS: AdminPermission[] = [
  "admin:access",
  "admin:dashboard",
  "admin:operations",
  "admin:releases",
  "admin:qc",
  "admin:artists",
  "admin:labels",
  "admin:users",
  "admin:staff_invite",
  "admin:finance",
  "admin:royalties",
  "admin:payouts",
  "admin:publishing",
  "admin:statements",
  "admin:analytics",
  "admin:distribution",
  "admin:ddex",
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
];

const ROLE_ADMIN_PERMS: Record<AppRole, AdminPermission[]> = {
  public_user: [],
  artist: [],
  label: [],
  support: SUPPORT_PERMS,
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

export function hasAdminPermission(roles: AppRole[], permission: AdminPermission): boolean {
  return adminPermissionsForRoles(roles).has(permission);
}

/**
 * Canonical route -> permission map. Middleware and navigation both use this,
 * so hiding a menu item never becomes the only authorization control.
 *
 * Order matters for nested prefixes. Unknown /admin/* routes fail to
 * admin:operations, which is admin/super_admin only.
 */
const ADMIN_PATH_PERMISSIONS: Array<{
  prefix: string;
  permission: AdminPermission;
}> = [
  { prefix: "/admin/finance/billing", permission: "admin:finance" },
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
  { prefix: "/admin/playlist-pitches", permission: "admin:distribution" },
  { prefix: "/admin/portal-requests", permission: "admin:support" },
  { prefix: "/admin/publishing", permission: "admin:publishing" },
  { prefix: "/admin/finance", permission: "admin:finance" },
  { prefix: "/admin/royalties", permission: "admin:royalties" },
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

/** Strict administrator roles for /nexo-admin (excludes support). */
export const ADMINISTRATOR_ROLES: AppRole[] = ["admin", "super_admin"];

export function isAdministratorRole(roles: AppRole[]): boolean {
  return roles.some((r) => ADMINISTRATOR_ROLES.includes(r));
}

/**
 * Post-password gate for administrator login.
 * Does not name denied roles in the user-facing message.
 */
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
