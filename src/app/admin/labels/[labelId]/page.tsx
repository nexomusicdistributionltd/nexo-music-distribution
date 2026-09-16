import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { AccountStatusForm } from "@/components/admin/AccountStatusForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Label detail",
  robots: { index: false, follow: false },
};

export default async function LabelDetailPage({
  params,
}: {
  params: Promise<{ labelId: string }>;
}) {
  await RequireAdmin();
  const { labelId } = await params;
  const supabase = await createClient();
  const { data: label } = await supabase
    .from("label_profiles")
    .select("*")
    .eq("id", labelId)
    .maybeSingle();
  if (!label) notFound();

  const ownerId = label.user_id as string | null;
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
      .select("id, title, status")
      .eq("label_profile_id", labelId)
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
      ? supabase.from("support_tickets").select("id, subject, status").eq("requester_user_id", ownerId).limit(10)
      : Promise.resolve({ data: [] }),
    ownerId
      ? supabase.from("compliance_cases").select("id, title, status").eq("subject_user_id", ownerId).limit(10)
      : Promise.resolve({ data: [] }),
    ownerId
      ? supabase
          .from("royalty_statements")
          .select("id, period_start, period_end, status, total_minor, currency")
          .eq("owner_user_id", ownerId)
          .limit(10)
      : Promise.resolve({ data: [] }),
    ownerId
      ? supabase.from("payouts").select("id, status, amount_minor, currency").eq("owner_user_id", ownerId).limit(10)
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={label.label_name} description={label.business_email} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-2 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
          <p className="text-small">Contact: {label.contact_name}</p>
          <p className="text-small">Account: {profile?.account_status ?? "—"}</p>
          {ownerId ? <AccountStatusForm userId={ownerId} /> : (
            <p className="text-caption text-[var(--nexo-text-muted)]">No linked login to suspend.</p>
          )}
        </section>
        <section>
          <h2 className="mb-2 text-h4">Releases</h2>
          {(releases ?? []).length === 0 ? (
            <EmptyState title="No related releases" />
          ) : (
            <ul className="space-y-1 text-small">
              {(releases ?? []).map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/releases/${r.id}`}>{r.title || "Untitled"}</Link>
                </li>
              ))}
            </ul>
          )}
          <h2 className="mt-4 text-h4">Tickets / compliance</h2>
          {(tickets ?? []).length === 0 && (compliance ?? []).length === 0 ? (
            <p className="text-caption text-[var(--nexo-text-muted)]">No tickets or cases.</p>
          ) : (
            <ul className="space-y-1 text-small">
              {(tickets ?? []).map((t) => <li key={t.id}>{t.subject} · {t.status}</li>)}
              {(compliance ?? []).map((c) => <li key={c.id}>{c.title} · {c.status}</li>)}
            </ul>
          )}
          <h2 className="mt-4 text-h4">Royalties / payouts</h2>
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
      <section>
        <h2 className="mb-2 text-h4">Operational timeline</h2>
        {(timeline ?? []).length === 0 ? (
          <EmptyState title="No timeline events" />
        ) : (
          <ul className="space-y-1 text-small">
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
