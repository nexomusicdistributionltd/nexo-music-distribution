import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { AccountStatusForm } from "@/components/admin/AccountStatusForm";
import { createClient } from "@/lib/supabase/server";
import { sanitizeAdminSearchQuery } from "@/lib/admin/search";
import { hasAdminPermission } from "@/lib/admin/permissions";

export const metadata: Metadata = {
  title: "Admin users",
  robots: { index: false, follow: false },
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await RequireAdmin();
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
  if (error) throw error;
  const canManage = hasAdminPermission(ctx.roles, "admin:users");

  return (
    <div>
      <PageHeader title="Users" description="All profiles. Role changes require super_admin." showSearch searchQ={sp.q} />
      {(data ?? []).length === 0 ? (
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
