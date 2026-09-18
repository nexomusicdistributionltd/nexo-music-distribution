import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { AccountStatusForm } from "@/components/admin/AccountStatusForm";
import { UserRolesForm } from "@/components/admin/UserRolesForm";
import { StaffInviteForm } from "@/components/admin/StaffInviteForm";
import { AccountPlanControl } from "@/components/admin/AccountPlanControl";
import { createClient } from "@/lib/supabase/server";
import { sanitizeAdminSearchQuery } from "@/lib/admin/search";
import { hasAdminPermission } from "@/lib/admin/permissions";
import { adminListErrorMessage } from "@/lib/db/admin-query";
import type { AppRole } from "@/lib/auth/types";

export const metadata: Metadata = {
  title: "Admin users",
  robots: { index: false, follow: false },
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await RequireAdminPermission("admin:users");
  const sp = await searchParams;
  const q = sanitizeAdminSearchQuery(sp.q);
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, email, full_name, display_name, account_status, account_type, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) {
    query = query.or(
      `email.ilike.%${q}%,full_name.ilike.%${q}%,display_name.ilike.%${q}%`
    );
  }
  const { data, error } = await query;
  const canManage = hasAdminPermission(ctx.roles, "admin:users");
  const canRoles = hasAdminPermission(ctx.roles, "admin:roles");
  const canInviteStaff = hasAdminPermission(ctx.roles, "admin:staff_invite");
  const ids = (data ?? []).map((u) => u.id);
  const { data: roleRows } = ids.length
    ? await supabase.from("user_roles").select("user_id, role").in("user_id", ids)
    : { data: [] as { user_id: string; role: string }[] };
  const rolesByUser = new Map<string, string[]>();
  for (const row of roleRows ?? []) {
    const list = rolesByUser.get(row.user_id) ?? [];
    list.push(row.role);
    rolesByUser.set(row.user_id, list);
  }

  return (
    <div>
      <PageHeader title="Users & access" description="Manage accounts, invite staff and control administrative roles." showSearch searchQ={sp.q} />
      {canInviteStaff ? <StaffInviteForm allowSuperAdmin={ctx.roles.includes("super_admin")} /> : null}
      {error ? (
        <ErrorState title="Users unavailable" description={adminListErrorMessage(error)} retryHref="/admin/users" />
      ) : (data ?? []).length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <ul className="space-y-4">
          {(data ?? []).map((u) => (
            <li
              key={u.id}
              className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{u.display_name || u.full_name || u.email}</p>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    {u.email} · {u.account_type} · {u.account_status}
                    {(rolesByUser.get(u.id) ?? []).length
                      ? ` · roles: ${(rolesByUser.get(u.id) ?? []).join(", ")}`
                      : ""}
                  </p>
                  <Link
                    href={`/admin/search?q=${encodeURIComponent(u.email)}`}
                    className="text-caption underline-offset-4 hover:underline"
                  >
                    Related search
                  </Link>
                </div>
                {canManage ? <AccountStatusForm userId={u.id} /> : null}
              </div>
              {canRoles && (rolesByUser.get(u.id) ?? []).some((r) => r === "artist" || r === "label") ? (
                <div className="mt-3"><AccountPlanControl userId={u.id} accountType={(rolesByUser.get(u.id) ?? []).includes("label") ? "label" : "artist"} /></div>
              ) : null}
              {canRoles ? (
                <div className="mt-3">
                  <UserRolesForm
                    userId={u.id}
                    currentRoles={(rolesByUser.get(u.id) ?? []) as AppRole[]}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
