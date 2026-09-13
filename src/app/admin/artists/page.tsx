import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { sanitizeAdminSearchQuery } from "@/lib/admin/search";
import { artistNameOf } from "@/lib/auth/types";

export const metadata: Metadata = {
  title: "Admin artists",
  robots: { index: false, follow: false },
};

export default async function AdminArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await RequireAdmin();
  const sp = await searchParams;
  const q = sanitizeAdminSearchQuery(sp.q);
  const supabase = await createClient();
  let query = supabase
    .from("artist_profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) {
    query = query.or(`stage_name.ilike.%${q}%,artist_name.ilike.%${q}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  const items = data ?? [];

  return (
    <div>
      <PageHeader title="Artists" description="Artist directory." showSearch searchQ={sp.q} />
      {items.length === 0 ? (
        <EmptyState title="No artists found" description="Artist profiles will appear after signup." />
      ) : (
        <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {items.map((row) => (
            <li key={row.id} className="px-4 py-3">
              <Link
                href={`/admin/artists/${row.id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {artistNameOf(row)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
