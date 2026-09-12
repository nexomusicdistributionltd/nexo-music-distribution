/**
 * Auth + RBAC architecture foundation (Batch 1).
 * No real auth provider connected. Protected route stubs only.
 */

import type { UserRole } from "@/architecture/db/types";

export const ALL_ROLES: UserRole[] = [
  "artist",
  "label_admin",
  "label_member",
  "publishing_admin",
  "publishing_member",
  "support",
  "admin",
  "super_admin",
];

export type Permission =
  | "catalog:read"
  | "catalog:write"
  | "release:submit"
  | "royalties:read"
  | "payouts:request"
  | "publishing:read"
  | "publishing:write"
  | "admin:users"
  | "admin:qc"
  | "support:tickets";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  artist: [
    "catalog:read",
    "catalog:write",
    "release:submit",
    "royalties:read",
    "payouts:request",
    "publishing:read",
    "support:tickets",
  ],
  label_member: [
    "catalog:read",
    "catalog:write",
    "royalties:read",
    "publishing:read",
    "support:tickets",
  ],
  label_admin: [
    "catalog:read",
    "catalog:write",
    "release:submit",
    "royalties:read",
    "payouts:request",
    "publishing:read",
    "support:tickets",
  ],
  publishing_member: ["publishing:read", "support:tickets"],
  publishing_admin: ["publishing:read", "publishing:write", "support:tickets"],
  support: ["support:tickets", "catalog:read"],
  admin: [
    "catalog:read",
    "catalog:write",
    "release:submit",
    "royalties:read",
    "payouts:request",
    "publishing:read",
    "publishing:write",
    "admin:users",
    "admin:qc",
    "support:tickets",
  ],
  super_admin: [
    "catalog:read",
    "catalog:write",
    "release:submit",
    "royalties:read",
    "payouts:request",
    "publishing:read",
    "publishing:write",
    "admin:users",
    "admin:qc",
    "support:tickets",
  ],
};

export function permissionsForRoles(roles: UserRole[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const role of roles) {
    for (const p of ROLE_PERMISSIONS[role] ?? []) set.add(p);
  }
  return set;
}

export function hasPermission(roles: UserRole[], permission: Permission): boolean {
  return permissionsForRoles(roles).has(permission);
}

/** Route → required permission map for future middleware. */
export const PROTECTED_ROUTE_STUBS: Record<string, Permission | Permission[]> = {
  "/portal": "catalog:read",
  "/portal/releases": "catalog:read",
  "/portal/releases/new": "catalog:write",
  "/portal/royalties": "royalties:read",
  "/portal/payouts": "payouts:request",
  "/portal/publishing": "publishing:read",
  "/admin": "admin:users",
  "/admin/qc": "admin:qc",
  "/support": "support:tickets",
};

/**
 * Placeholder guard — always denies until real auth is wired.
 * Do not fake a logged-in session.
 */
export function assertAuthenticated(): never {
  throw new Error(
    "Authentication is not connected in Batch 1. Wire an auth provider before enabling protected routes."
  );
}
