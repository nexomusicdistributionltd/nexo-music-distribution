import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { AccountStatusForm } from "@/components/admin/AccountStatusForm";
import { ArtistWebsiteEditor } from "@/components/website/ArtistWebsiteEditor";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { artistNameOf } from "@/lib/auth/types";

export const metadata: Metadata = {
  title: "Artist detail",
  robots: { index: false, follow: false },
};

export default async function ArtistDetailPage({
  params,
}: {
  params: Promise<{ artistId: string }>;
}) {
  await RequireAdmin();
  const { artistId } = await params;
  const supabase = await createClient();
  const { data: artist } = await supabase
    .from("artist_profiles")
    .select("*")
    .eq("id", artistId)
    .maybeSingle();
  if (!artist) notFound();

  const ownerId = artist.user_id as string | null;
  const [
    { data: profile },
    { data: releases },
    { data: timeline },
    { data: tickets },
    { data: compliance },
    { data: royalties },
    { data: payouts },
  ] = await Promise.all([
    ownerId
      ? supabase.from("profiles").select("*").eq("id", ownerId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("releases")
      .select("id, title, status, updated_at")
      .eq("artist_profile_id", artistId)
      .order("updated_at", { ascending: false })
      .limit(20),
    ownerId
      ? supabase
          .from("activity_events")
          .select("*")
          .eq("subject_user_id", ownerId)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    ownerId
      ? supabase
          .from("support_tickets")
          .select("id, subject, status, updated_at")
          .eq("requester_user_id", ownerId)
          .limit(10)
      : Promise.resolve({ data: [] }),
    ownerId
      ? supabase
          .from("compliance_cases")
          .select("id, title, status, created_at")
          .eq("subject_user_id", ownerId)
          .limit(10)
      : Promise.resolve({ data: [] }),
    ownerId
      ? supabase
          .from("royalty_statements")
          .select("id, period_start, period_end, status, total_minor, currency")
          .eq("owner_user_id", ownerId)
          .limit(10)
      : Promise.resolve({ data: [] }),
    ownerId
      ? supabase
          .from("payouts")
          .select("id, status, amount_minor, currency, created_at")
          .eq("owner_user_id", ownerId)
          .limit(10)
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={artistNameOf(artist)}
        description={profile?.email || artist.user_id}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-2 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
          <h2 className="text-h4">Profile</h2>
          <p className="text-small">Status: {profile?.account_status ?? "—"}</p>
          <p className="text-small">{artist.bio || "No bio."}</p>
          {ownerId ? (
            <AccountStatusForm userId={ownerId} />
          ) : (
            <p className="text-caption text-[var(--nexo-text-muted)]">
              Roster-only artist — no linked login to suspend.
            </p>
          )}
        </section>
        <section className="space-y-2">
          <h2 className="text-h4">Releases</h2>
          {(releases ?? []).length === 0 ? (
            <EmptyState title="No related releases" />
          ) : (
            <ul className="space-y-1 text-small">
              {(releases ?? []).map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/releases/${r.id}`} className="underline-offset-4 hover:underline">
                    {r.title || "Untitled"} ({r.status})
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <h2 className="pt-4 text-h4">Tickets</h2>
          {(tickets ?? []).length === 0 ? (
            <p className="text-caption text-[var(--nexo-text-muted)]">No tickets.</p>
          ) : (
            <ul className="space-y-1 text-small">
              {(tickets ?? []).map((t) => (
                <li key={t.id}>
                  <Link href={`/admin/support?ticket=${t.id}`}>{t.subject}</Link>
                </li>
              ))}
            </ul>
          )}
          <h2 className="pt-4 text-h4">Compliance</h2>
          {(compliance ?? []).length === 0 ? (
            <p className="text-caption text-[var(--nexo-text-muted)]">No cases.</p>
          ) : (
            <ul className="space-y-1 text-small">
              {(compliance ?? []).map((c) => <li key={c.id}>{c.title} · {c.status}</li>)}
            </ul>
          )}
          <h2 className="pt-4 text-h4">Royalties / payouts</h2>
          {(royalties ?? []).length === 0 && (payouts ?? []).length === 0 ? (
            <p className="text-caption text-[var(--nexo-text-muted)]">No financial data available yet.</p>
          ) : (
            <ul className="space-y-1 text-small">
              {(royalties ?? []).map((r) => (
                <li key={r.id}>Statement {r.period_start}–{r.period_end} · {r.total_minor} {r.currency} minor units · {r.status}</li>
              ))}
              {(payouts ?? []).map((p) => (
                <li key={p.id}>Payout {p.amount_minor} {p.currency} minor units · {p.status}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <ArtistWebsiteEditor artist={artist} />
      <section>
        <h2 className="mb-2 text-h4">Operational timeline</h2>
        {(timeline ?? []).length === 0 ? (
          <EmptyState
            title="No timeline events"
            description="Staff-visible operational events will appear here (private notes are excluded)."
          />
        ) : (
          <ul className="space-y-2 text-small">
            {(timeline ?? []).map((e) => (
              <li key={e.id}>
                {new Date(e.created_at).toLocaleString()} — {e.summary}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
