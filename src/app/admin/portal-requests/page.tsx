import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageIntro } from "@/components/workspace/PageIntro";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  PortalRequestReviewClient,
  type PortalReviewRow,
} from "@/components/admin/PortalRequestReviewClient";
import { formatMinorUnits } from "@/lib/finance/money";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Portal requests",
  robots: { index: false, follow: false },
};

export default async function AdminPortalRequestsPage() {
  await RequireAdmin();
  const db = await createClient();

  const [{ data: services }, { data: videos }, { data: payouts }] = await Promise.all([
    db
      .from("portal_service_requests")
      .select("id,kind,title,status,created_at,owner_user_id,admin_note")
      .order("created_at", { ascending: false })
      .limit(200),
    db
      .from("music_video_submissions")
      .select("id,title,status,created_at,video_url,owner_user_id,admin_note")
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("payouts")
      .select("id,owner_user_id,amount_minor,currency,status,created_at")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const ownerIds = [
    ...new Set([
      ...(services ?? []).map((row) => row.owner_user_id),
      ...(videos ?? []).map((row) => row.owner_user_id),
    ]),
  ];
  const { data: profiles } = ownerIds.length
    ? await db
        .from("profiles")
        .select("id,email,display_name,full_name")
        .in("id", ownerIds)
    : { data: [] };

  const profileById = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      profile.display_name || profile.full_name || profile.email || profile.id,
    ])
  );

  const reviewRows: PortalReviewRow[] = [
    ...(services ?? []).map((row) => ({
      id: row.id,
      type: "service" as const,
      title: row.title,
      kind: row.kind,
      status: row.status,
      adminNote: row.admin_note,
      ownerLabel: profileById.get(row.owner_user_id) ?? row.owner_user_id,
      createdAt: row.created_at,
    })),
    ...(videos ?? []).map((row) => ({
      id: row.id,
      type: "video" as const,
      title: row.title,
      kind: "music_video",
      status: row.status,
      adminNote: row.admin_note,
      ownerLabel: profileById.get(row.owner_user_id) ?? row.owner_user_id,
      createdAt: row.created_at,
    })),
  ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return (
    <div className="space-y-7">
      <PageIntro
        title="Portal requests"
        description="Review Artist and Label service requests from Marketing, Rights, Catalog and video workflows. Status updates are stored and sent back to the account."
      />

      <section className="space-y-3">
        <h2 className="text-h4">Service & content review</h2>
        {reviewRows.length === 0 ? (
          <EmptyState title="No service requests" />
        ) : (
          <PortalRequestReviewClient rows={reviewRows} />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-h4">Recent payout requests</h2>
            <p className="text-small text-[var(--nexo-text-muted)]">
              Finance controls and payout destinations are managed in the dedicated payout workspace.
            </p>
          </div>
          <Link href="/admin/payouts" className="text-small underline-offset-4 hover:underline">
            Open payouts
          </Link>
        </div>
        {(payouts ?? []).length === 0 ? (
          <EmptyState title="No payout requests" />
        ) : (
          <ul className="divide-y divide-[var(--nexo-divider)] overflow-hidden rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
            {(payouts ?? []).map((row) => (
              <li key={row.id} className="flex flex-wrap justify-between gap-3 px-4 py-3 text-small">
                <span>{row.owner_user_id}</span>
                <span className="tabular-nums">
                  {formatMinorUnits(Number(row.amount_minor), String(row.currency).trim())} ·{" "}
                  {String(row.status).replace(/_/g, " ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
