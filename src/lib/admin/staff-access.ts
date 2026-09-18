import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AppRole, AuthUserContext } from "@/lib/auth/types";
import {
  adminPermissionsForRoles,
  isAdminPermission,
  type AdminPermission,
} from "@/lib/admin/permissions";

export type StaffTeamRoleRecord = {
  role_key: string;
  name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
};

export async function getEffectiveAdminPermissions(input: {
  userId: string;
  roles: AppRole[];
}): Promise<Set<AdminPermission>> {
  const permissions = adminPermissionsForRoles(input.roles);

  // Administrators are intentionally full day-to-day operators.
  if (input.roles.includes("admin") || input.roles.includes("super_admin")) {
    return permissions;
  }

  if (!input.roles.includes("support")) return permissions;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_staff_permissions");
  if (error || !Array.isArray(data)) return permissions;

  for (const value of data) {
    if (isAdminPermission(value)) permissions.add(value);
  }
  return permissions;
}

export async function getEffectiveAdminPermissionsForContext(
  ctx: AuthUserContext
): Promise<Set<AdminPermission>> {
  return getEffectiveAdminPermissions({ userId: ctx.userId, roles: ctx.roles });
}

export async function listActiveStaffTeamRoles(): Promise<StaffTeamRoleRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_roles")
    .select("role_key,name,description,sort_order,is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) return [];
  return (data ?? []) as StaffTeamRoleRecord[];
}

export async function listStaffTeamAssignments(userIds: string[]) {
  if (userIds.length === 0) return [] as Array<{ user_id: string; role_key: string }>;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("staff_role_assignments")
    .select("user_id,role_key")
    .in("user_id", userIds);
  if (error) return [] as Array<{ user_id: string; role_key: string }>;
  return (data ?? []) as Array<{ user_id: string; role_key: string }>;
}
