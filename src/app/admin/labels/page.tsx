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
import { adminListErrorMessage } from "@/lib/db/admin-query";

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
    .select("id, label_name, business_email, country, logo_url, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) {
    query = query.or(`label_name.ilike.%${q}%,business_email.ilike.%${q}%`);
  }
  const { data, error } = await query;

  return (
    <div className="space-y-6">
      <PageIntro title="Labels" description="Label directory from real profiles." />
      {error ? (
        <ErrorState title="Labels unavailable" description={adminListErrorMessage(error)} retryHref="/admin/labels" />
      ) : (data ?? []).length === 0 ? (
        <EmptyState title="No labels found" />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Label</TH>
              <TH>Email</TH>
              <TH>Country</TH>
            </TR>
          </THead>
          <TBody>
            {(data ?? []).map((row) => (
              <TR key={row.id}>
                <TD>
                  <Link
                    href={`/admin/labels/${row.id}`}
                    className="flex items-center gap-3 font-medium underline-offset-4 hover:underline"
                  >
                    <CoverArt src={row.logo_url} title={row.label_name} size={32} />
                    {row.label_name}
                  </Link>
                </TD>
                <TD>{row.business_email}</TD>
                <TD>{row.country || "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
