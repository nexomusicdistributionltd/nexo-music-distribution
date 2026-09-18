import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { PageHeader } from "@/components/admin/PageHeader";
import { StaffInviteForm } from "@/components/admin/StaffInviteForm";
import { StaffRoleForm } from "@/components/admin/StaffRoleForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
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
    label: "Support Staff",
    description:
      "Support, QC, catalog lookup and notifications. No finance, royalties, TooLost distribution, staff management or settings.",
  },
  admin: {
    label: "Administrator",
    description:
      "Full day-to-day Nexo operations including users, releases, finance, TooLost distribution, DDEX, website and settings.",
  },
  super_admin: {
    label: "Super Admin",
    description:
      "Full administrator access plus privileged role management and protection of the Super Admin chain.",
  },
};

export default async function AdminRolesPage() {
  const ctx = await RequireAdminPermission("admin:staff_invite");
  const supabase = await createClient();
  const canManageRoles = hasAdminPermission(ctx.roles, "admin:roles");

  const { data: roleRows, error: rolesError } = await supabase
    .from("user_roles")
    .select("user_id, role, created_at")
    .in("role", ["support", "admin", "super_admin"]);

  const userIds = [...new Set((roleRows ?? []).map((row) => row.user_id))];
  const { data: profiles, error: profilesError } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, email, display_name, full_name, account_status, account_type, created_at")
        .in("id", userIds)
    : { data: [], error: null };

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const staffByUser = new Map<
    string,
    { user_id: string; role: StaffRole; roles: StaffRole[]; created_at: string | null }
  >();

  for (const row of roleRows ?? []) {
    if (row.role !== "support" && row.role !== "admin" && row.role !== "super_admin") continue;
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
        description="Invite Nexo staff, see every administrative account and manage access levels from one realtime control panel."
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

      <StaffInviteForm allowSuperAdmin={ctx.roles.includes("super_admin")} />

      {rolesError || profilesError ? (
        <ErrorState
          title="Staff roles unavailable"
          description={(rolesError ?? profilesError)?.message ?? "Could not load staff roles."}
          retryHref="/admin/roles"
        />
      ) : staff.length === 0 ? (
        <EmptyState
          title="No staff accounts found"
          description="Invite an administrator or support staff member to create the first staff entry."
        />
      ) : (
        <section className="space-y-3">
          <div>
            <h2 className="text-h4">Administrative accounts</h2>
            <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
              Updates appear automatically through Supabase Realtime. Only Super Admins can change an existing staff access level.
            </p>
          </div>
          <ul className="grid gap-3 lg:grid-cols-2">
            {staff.map((row) => {
              const profile = row.profile;
              return (
                <li
                  key={row.user_id}
                  className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {profile?.display_name || profile?.full_name || profile?.email || row.user_id}
                      </p>
                      <p className="mt-1 break-all text-caption text-[var(--nexo-text-muted)]">
                        {profile?.email || "Email unavailable"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="rounded-full border border-[var(--nexo-border)] px-2.5 py-1 text-caption font-medium">
                        {ROLE_COPY[row.role].label}
                      </span>
                      {row.roles.length > 1 ? (
                        <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
                          Legacy roles: {row.roles.map((role) => ROLE_COPY[role].label).join(", ")}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-caption">
                    <div>
                      <dt className="text-[var(--nexo-text-muted)]">Account status</dt>
                      <dd className="mt-1 font-medium">{profile?.account_status ?? "unknown"}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--nexo-text-muted)]">Account type</dt>
                      <dd className="mt-1 font-medium">{profile?.account_type ?? row.role}</dd>
                    </div>
                  </dl>

                  {canManageRoles ? (
                    <StaffRoleForm userId={row.user_id} currentRole={row.role} />
                  ) : (
                    <p className="mt-4 text-caption text-[var(--nexo-text-muted)]">
                      Role changes require Super Admin access.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
