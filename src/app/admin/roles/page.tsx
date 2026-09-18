import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { PageHeader } from "@/components/admin/PageHeader";
import { StaffInviteForm } from "@/components/admin/StaffInviteForm";
import { StaffRoleForm } from "@/components/admin/StaffRoleForm";
import { StaffTeamRolesForm } from "@/components/admin/StaffTeamRolesForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { listActiveStaffTeamRoles } from "@/lib/admin/staff-access";
import type { AppRole } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staff & Admin Roles",
  robots: { index: false, follow: false },
};

type StaffRole = Extract<AppRole, "support" | "admin" | "super_admin">;

const STAFF_ROLE_ORDER: Record<StaffRole, number> = {
  super_admin: 0,
  admin: 1,
  support: 2,
};

const ROLE_COPY: Record<StaffRole, { label: string; description: string }> = {
  support: {
    label: "Team Staff",
    description:
      "Least-privilege staff account. Access is built from one or more functional teams.",
  },
  admin: {
    label: "Administrator",
    description:
      "Full day-to-day Nexo administration. Can invite and manage functional staff teams.",
  },
  super_admin: {
    label: "Super Admin",
    description:
      "Full access plus Administrator/Super Admin promotion and privileged role management.",
  },
};

function permissionLabel(permission: string) {
  return permission
    .replace(/^admin:/, "")
    .replace(/_/g, " ")
    .replace(/:/g, " · ");
}

export default async function AdminRolesPage() {
  const ctx = await RequireAdminPermission("admin:staff_invite");
  const supabase = await createClient();
  const canManageBaseRoles = hasAdminPermission(ctx.roles, "admin:roles");
  const teamRoles = await listActiveStaffTeamRoles();

  const [{ data: roleRows, error: rolesError }, { data: permissionRows }] =
    await Promise.all([
      supabase
        .from("user_roles")
        .select("user_id, role, created_at")
        .in("role", ["support", "admin", "super_admin"]),
      supabase
        .from("staff_role_permissions")
        .select("role_key, permission")
        .order("permission", { ascending: true }),
    ]);

  const userIds = [...new Set((roleRows ?? []).map((row) => row.user_id))];
  const profileResult = userIds.length
    ? await supabase
        .from("profiles")
        .select(
          "id, email, display_name, full_name, account_status, account_type, created_at"
        )
        .in("id", userIds)
    : null;
  const assignmentResult = userIds.length
    ? await supabase
        .from("staff_role_assignments")
        .select("user_id, role_key")
        .in("user_id", userIds)
    : null;

  const profiles = profileResult?.data ?? [];
  const profilesError = profileResult?.error ?? null;
  const assignmentRows = assignmentResult?.data ?? [];

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const assignmentsByUser = new Map<string, string[]>();
  for (const row of assignmentRows ?? []) {
    const list = assignmentsByUser.get(row.user_id) ?? [];
    if (!list.includes(row.role_key)) list.push(row.role_key);
    assignmentsByUser.set(row.user_id, list);
  }

  const permissionsByTeam = new Map<string, string[]>();
  for (const row of permissionRows ?? []) {
    const list = permissionsByTeam.get(row.role_key) ?? [];
    if (!list.includes(row.permission)) list.push(row.permission);
    permissionsByTeam.set(row.role_key, list);
  }

  const staffByUser = new Map<
    string,
    { user_id: string; role: StaffRole; roles: StaffRole[]; created_at: string | null }
  >();

  for (const row of roleRows ?? []) {
    if (row.role !== "support" && row.role !== "admin" && row.role !== "super_admin") {
      continue;
    }
    const role = row.role as StaffRole;
    const existing = staffByUser.get(row.user_id);
    if (!existing) {
      staffByUser.set(row.user_id, {
        user_id: row.user_id,
        role,
        roles: [role],
        created_at: row.created_at ?? null,
      });
      continue;
    }
    if (!existing.roles.includes(role)) existing.roles.push(role);
    if (STAFF_ROLE_ORDER[role] < STAFF_ROLE_ORDER[existing.role]) existing.role = role;
  }

  const staff = [...staffByUser.values()]
    .map((row) => ({
      ...row,
      profile: profileById.get(row.user_id) ?? null,
      teamRoleKeys: assignmentsByUser.get(row.user_id) ?? [],
    }))
    .sort((left, right) => {
      const roleDiff = STAFF_ROLE_ORDER[left.role] - STAFF_ROLE_ORDER[right.role];
      if (roleDiff !== 0) return roleDiff;
      return (left.profile?.email ?? "").localeCompare(right.profile?.email ?? "");
    });

  const counts = {
    super_admin: staff.filter((row) => row.role === "super_admin").length,
    admin: staff.filter((row) => row.role === "admin").length,
    support: staff.filter((row) => row.role === "support").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & Admin Roles"
        description="Invite staff, combine functional team roles, and enforce least-privilege access across Nexo administration and TooLost operations."
      />

      <section className="grid gap-3 sm:grid-cols-3">
        {(["super_admin", "admin", "support"] as StaffRole[]).map((role) => (
          <div
            key={role}
            className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4"
          >
            <p className="text-caption uppercase tracking-[0.12em] text-[var(--nexo-text-muted)]">
              {ROLE_COPY[role].label}
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{counts[role]}</p>
            <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
              {ROLE_COPY[role].description}
            </p>
          </div>
        ))}
      </section>

      <StaffInviteForm
        teamRoles={teamRoles}
        allowAdministratorLevel={ctx.roles.includes("super_admin")}
      />

      <section className="space-y-3">
        <div>
          <h2 className="text-h4">Functional teams</h2>
          <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
            Staff can belong to multiple teams. Their effective access is the union of these
            permission sets.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {teamRoles.map((team) => (
            <article
              key={team.role_key}
              className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium">{team.name}</h3>
                <span className="rounded-full border border-[var(--nexo-border)] px-2 py-0.5 text-caption">
                  {staff.filter((row) => row.role === "support" && row.teamRoleKeys.includes(team.role_key)).length}
                </span>
              </div>
              <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
                {team.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(permissionsByTeam.get(team.role_key) ?? [])
                  .filter(
                    (permission) =>
                      permission !== "admin:access" && permission !== "admin:dashboard"
                  )
                  .map((permission) => (
                    <span
                      key={permission}
                      className="rounded-full bg-[var(--nexo-bg)] px-2 py-1 text-[11px] text-[var(--nexo-text-muted)]"
                    >
                      {permissionLabel(permission)}
                    </span>
                  ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {rolesError || profilesError ? (
        <ErrorState
          title="Staff roles unavailable"
          description={(rolesError ?? profilesError)?.message ?? "Could not load staff roles."}
          retryHref="/admin/roles"
        />
      ) : staff.length === 0 ? (
        <EmptyState
          title="No staff accounts found"
          description="Invite a team member to create the first staff entry."
        />
      ) : (
        <section className="space-y-3">
          <div>
            <h2 className="text-h4">Team members</h2>
            <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
              Administrators can manage functional teams. Only Super Admins can promote an
              account to Administrator or Super Admin.
            </p>
          </div>
          <ul className="grid gap-3 lg:grid-cols-2">
            {staff.map((row) => {
              const profile = row.profile;
              const assignedNames = teamRoles
                .filter((team) => row.teamRoleKeys.includes(team.role_key))
                .map((team) => team.name);
              return (
                <li
                  key={row.user_id}
                  className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {profile?.display_name ||
                          profile?.full_name ||
                          profile?.email ||
                          row.user_id}
                      </p>
                      <p className="mt-1 break-all text-caption text-[var(--nexo-text-muted)]">
                        {profile?.email || "Email unavailable"}
                      </p>
                    </div>
                    <span className="rounded-full border border-[var(--nexo-border)] px-2.5 py-1 text-caption font-medium">
                      {ROLE_COPY[row.role].label}
                    </span>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-caption">
                    <div>
                      <dt className="text-[var(--nexo-text-muted)]">Account status</dt>
                      <dd className="mt-1 font-medium">
                        {profile?.account_status ?? "unknown"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--nexo-text-muted)]">Team access</dt>
                      <dd className="mt-1 font-medium">
                        {row.role === "support"
                          ? assignedNames.length
                            ? assignedNames.join(", ")
                            : "No functional team"
                          : "Full administrative access"}
                      </dd>
                    </div>
                  </dl>

                  {row.role === "support" ? (
                    <StaffTeamRolesForm
                      userId={row.user_id}
                      teamRoles={teamRoles}
                      currentRoleKeys={row.teamRoleKeys}
                    />
                  ) : null}

                  {canManageBaseRoles ? (
                    <StaffRoleForm userId={row.user_id} currentRole={row.role} />
                  ) : row.role !== "support" ? (
                    <p className="mt-4 text-caption text-[var(--nexo-text-muted)]">
                      Administrator-level changes require Super Admin access.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
