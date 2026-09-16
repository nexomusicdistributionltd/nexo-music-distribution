import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageIntro } from "@/components/workspace/PageIntro";
import { CoverArt } from "@/components/workspace/CoverArt";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { createClient } from "@/lib/supabase/server";
import { sanitizeAdminSearchQuery } from "@/lib/admin/search";
import { artistNameOf } from "@/lib/auth/types";
import { adminListErrorMessage } from "@/lib/db/admin-query";

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
    .select("id, stage_name, artist_name, country, avatar_url, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) {
    query = query.or(`stage_name.ilike.%${q}%,artist_name.ilike.%${q}%`);
  }
  const { data, error } = await query;
  const items = data ?? [];

  return (
    <div className="space-y-6">
      <PageIntro title="Artists" description="Artist directory from real profiles." />
      {error ? (
        <ErrorState title="Artists unavailable" description={adminListErrorMessage(error)} retryHref="/admin/artists" />
      ) : items.length === 0 ? (
        <EmptyState title="No artists found" description="Artist profiles will appear after signup or roster create." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Artist</TH>
              <TH>Account</TH>
              <TH>Country</TH>
            </TR>
          </THead>
          <TBody>
            {items.map((row) => (
              <TR key={row.id}>
                <TD>
                  <Link
                    href={`/admin/artists/${row.id}`}
                    className="flex items-center gap-3 font-medium underline-offset-4 hover:underline"
                  >
                    <CoverArt src={row.avatar_url} title={artistNameOf(row)} size={32} />
                    {artistNameOf(row)}
                  </Link>
                </TD>
                <TD className="text-caption text-[var(--nexo-text-muted)]">
                  {row.user_id ? "Linked user" : "Roster only"}
                </TD>
                <TD>{row.country || "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
