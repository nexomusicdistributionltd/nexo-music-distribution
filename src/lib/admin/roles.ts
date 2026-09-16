import type { AppRole } from "@/lib/auth/types";

export const ASSIGNABLE_ROLES: AppRole[] = [
  "artist",
  "label",
  "support",
  "admin",
  "super_admin",
];

const ASSIGNABLE = new Set<AppRole>(ASSIGNABLE_ROLES);

export type RoleAssignmentInput = {
  actorId: string;
  targetId: string;
  currentRoles: AppRole[];
  nextRoles: AppRole[];
  superAdminCount: number;
  hasLabelRoster: boolean;
  hasArtistOwnedReleases: boolean;
};

export function normalizeRoleList(roles: readonly string[]): AppRole[] {
  const out: AppRole[] = [];
  const seen = new Set<string>();
  for (const r of roles) {
    if (!ASSIGNABLE.has(r as AppRole) || seen.has(r)) continue;
    seen.add(r);
    out.push(r as AppRole);
  }
  return out;
}

/**
 * Super-admin role mutation rules.
 * - Last super_admin cannot be demoted (lockout).
 * - Artist + label together is refused (roster/catalog ownership).
 * - Revoking label while roster artists exist is refused.
 * - Revoking artist while that login owns catalog releases is refused.
 */
export function evaluateRoleAssignment(
  input: RoleAssignmentInput
): { ok: true; roles: AppRole[] } | { ok: false; error: string } {
  const next = normalizeRoleList(input.nextRoles);
  if (next.length !== input.nextRoles.filter(Boolean).length) {
    const unknown = input.nextRoles.filter((r) => r && !ASSIGNABLE.has(r));
    if (unknown.length) return { ok: false, error: "Unknown or unassignable role." };
  }
  for (const r of input.nextRoles) {
    if (r && !ASSIGNABLE.has(r)) return { ok: false, error: "Unknown or unassignable role." };
  }

  if (next.includes("artist") && next.includes("label")) {
    return {
      ok: false,
      error: "Artist and label cannot be combined on one account (roster ownership).",
    };
  }

  const hadSuper = input.currentRoles.includes("super_admin");
  const keepsSuper = next.includes("super_admin");
  if (hadSuper && !keepsSuper && input.superAdminCount <= 1) {
    return { ok: false, error: "Cannot remove the last super_admin." };
  }
  if (input.actorId === input.targetId && hadSuper && !keepsSuper) {
    return { ok: false, error: "Cannot remove your own super_admin role." };
  }

  const hadLabel = input.currentRoles.includes("label");
  const keepsLabel = next.includes("label");
  if (hadLabel && !keepsLabel && input.hasLabelRoster) {
    return {
      ok: false,
      error: "Cannot revoke label while roster artists exist.",
    };
  }

  const hadArtist = input.currentRoles.includes("artist");
  const keepsArtist = next.includes("artist");
  if (hadArtist && !keepsArtist && input.hasArtistOwnedReleases) {
    return {
      ok: false,
      error: "Cannot revoke artist while this account owns catalog releases.",
    };
  }

  return { ok: true, roles: next };
}
