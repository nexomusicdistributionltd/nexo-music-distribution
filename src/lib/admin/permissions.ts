import type { AppRole } from "@/lib/auth/types";

/** Granular permissions for admin portal (future-ready). */
export type AdminPermission =
  | "admin:access"
  | "admin:dashboard"
  | "admin:releases"
  | "admin:qc"
  | "admin:artists"
  | "admin:labels"
  | "admin:users"
  | "admin:finance"
  | "admin:royalties"
  | "admin:payouts"
  | "admin:publishing"
  | "admin:statements"
  | "admin:analytics"
  | "admin:distribution"
  | "admin:compliance"
  | "admin:support"
  | "admin:contact"
  | "admin:notifications"
  | "admin:audit"
  | "admin:reports"
  | "admin:settings"
  | "admin:search"
  | "admin:roles" // super_admin only
  | "admin:payouts:mark_paid"; // blocked without real payment op

const STAFF_BASE: AdminPermission[] = [
  "admin:access",
  "admin:dashboard",
  "admin:releases",
  "admin:qc",
  "admin:artists",
  "admin:labels",
  "admin:finance",
  "admin:royalties",
  "admin:payouts",
  "admin:publishing",
  "admin:statements",
  "admin:analytics",
  "admin:distribution",
  "admin:compliance",
  "admin:support",
  "admin:contact",
  "admin:notifications",
  "admin:audit",
  "admin:reports",
  "admin:search",
];

const ROLE_ADMIN_PERMS: Record<AppRole, AdminPermission[]> = {
  public_user: [],
  artist: [],
  label: [],
  support: [...STAFF_BASE],
  admin: [...STAFF_BASE, "admin:users", "admin:settings"],
  super_admin: [...STAFF_BASE, "admin:users", "admin:settings", "admin:roles"],
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
