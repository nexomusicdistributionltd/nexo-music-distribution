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
  if (!error && (data ?? []).length > 0) {
    return (data ?? []) as StaffTeamRoleRecord[];
  }

  // The functional team catalog is part of the product contract. Keep the invite UI
  // usable if an older environment has not seeded staff_roles yet; server-side invite
  // validation still rejects any role that is not present in the database.
  return [
    { role_key: "support", name: "Customer Support", description: "Support tickets, website messages, user lookup and release context.", sort_order: 10, is_active: true },
    { role_key: "quality_control", name: "Quality Control", description: "Review release metadata and assets, approve or return releases for corrections.", sort_order: 20, is_active: true },
    { role_key: "release_operations", name: "Release Operations", description: "Release records, catalog context and operational corrections.", sort_order: 30, is_active: true },
    { role_key: "distribution", name: "Distribution", description: "Provider delivery, status, catalog migration and distribution sync.", sort_order: 40, is_active: true },
    { role_key: "ddex_delivery", name: "DDEX Delivery", description: "DDEX generation, validation, delivery and acknowledgements.", sort_order: 50, is_active: true },
    { role_key: "finance", name: "Finance", description: "Finance overview, statements and reconciliations.", sort_order: 60, is_active: true },
    { role_key: "royalties", name: "Royalties & SplitShare", description: "Royalty reporting, SplitShare, statements and earnings analytics.", sort_order: 70, is_active: true },
    { role_key: "payouts", name: "Payout Operations", description: "Payout requests and payout methods.", sort_order: 80, is_active: true },
    { role_key: "publishing", name: "Publishing", description: "Publishing works, parties, shares and registrations.", sort_order: 90, is_active: true },
    { role_key: "compliance", name: "Compliance & Verification", description: "Identity verification, agreements, fraud and compliance.", sort_order: 100, is_active: true },
    { role_key: "analytics", name: "Analytics & Reports", description: "Platform analytics and operational reports.", sort_order: 110, is_active: true },
    { role_key: "billing", name: "Billing", description: "Artist and label plan and billing administration.", sort_order: 120, is_active: true },
    { role_key: "communications", name: "Communications", description: "Email center, newsletter, notifications and contact replies.", sort_order: 130, is_active: true },
    { role_key: "website", name: "Website & CMS", description: "Website, partners, blog, pages, videos and CMS media.", sort_order: 140, is_active: true },
    { role_key: "marketing", name: "Marketing", description: "Playlist pitching and promotional operations.", sort_order: 150, is_active: true },
    { role_key: "auditor", name: "Auditor", description: "Audit trail, reporting and analytics visibility.", sort_order: 160, is_active: true },
  ];
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
