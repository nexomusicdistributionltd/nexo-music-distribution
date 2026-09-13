import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { sanitizeAdminSearchQuery } from "@/lib/admin/search";

export const metadata: Metadata = {
  title: "Admin labels",
  robots: { index: false, follow: false },
};

export default async function AdminLabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await RequireAdmin();
  const sp = await searchParams;
  const q = sanitizeAdminSearchQuery(sp.q);
  const supabase = await createClient();
  let query = supabase
    .from("label_profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) {
    query = query.or(`label_name.ilike.%${q}%,business_email.ilike.%${q}%`);
  }
  const { data, error } = await query;
  if (error) throw error;

  return (
    <div>
      <PageHeader title="Labels" description="Label directory." showSearch searchQ={sp.q} />
      {(data ?? []).length === 0 ? (
        <EmptyState title="No labels found" />
      ) : (
        <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {(data ?? []).map((row) => (
            <li key={row.id} className="px-4 py-3">
              <Link
                href={`/admin/labels/${row.id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {row.label_name}
              </Link>
              <p className="text-caption text-[var(--nexo-text-muted)]">{row.business_email}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
