/**
 * Auth + RBAC — Batch 3/5.
 * Roles are enforced in Postgres (user_roles + RLS). This module mirrors
 * application-level checks for UI and route helpers.
 */

import type { AppRole } from "@/lib/auth/types";

export type { AppRole };

export const ALL_ROLES: AppRole[] = [
  "public_user",
  "artist",
  "label",
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
  | "admin:access"
  | "admin:finance"
  | "admin:roles"
  | "support:tickets"
  | "audit:read";

const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  public_user: [],
  artist: [
    "catalog:read",
    "catalog:write",
    "release:submit",
    "royalties:read",
    "payouts:request",
    "publishing:read",
    "support:tickets",
  ],
  label: [
    "catalog:read",
    "catalog:write",
    "release:submit",
    "royalties:read",
    "payouts:request",
    "publishing:read",
    "support:tickets",
  ],
  support: [
    "support:tickets",
    "catalog:read",
    "admin:access",
    "admin:qc",
    "audit:read",
  ],
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
    "admin:access",
    "admin:finance",
    "support:tickets",
    "audit:read",
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
    "admin:access",
    "admin:finance",
    "admin:roles",
    "support:tickets",
    "audit:read",
  ],
};

export function permissionsForRoles(roles: AppRole[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const role of roles) {
    for (const p of ROLE_PERMISSIONS[role] ?? []) set.add(p);
  }
  return set;
}

export function hasPermission(roles: AppRole[], permission: Permission): boolean {
  return permissionsForRoles(roles).has(permission);
}

export const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/releases",
  "/earnings",
  "/analytics",
  "/profile",
  "/app",
  "/support",
  "/admin",
] as const;
