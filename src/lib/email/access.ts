import { hasAdminPermission, isAdminPortalRole, type AdminPermission } from "@/lib/admin/permissions";
import type { AppRole } from "@/lib/auth/types";

export const EMAIL_CENTER_PERMISSION: AdminPermission = "admin:emails";

/** Artist / label / anonymous must never reach the Admin Email Center. */
export function canAccessEmailCenter(roles: AppRole[] | null | undefined): boolean {
  if (!roles?.length) return false;
  if (!isAdminPortalRole(roles)) return false;
  return hasAdminPermission(roles, EMAIL_CENTER_PERMISSION);
}
