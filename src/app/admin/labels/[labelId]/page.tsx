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

  const [{ data: profile }, { data: releases }, { data: timeline }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", label.user_id).maybeSingle(),
    supabase
      .from("releases")
      .select("id, title, status")
      .eq("label_profile_id", labelId)
      .limit(20),
    supabase
      .from("activity_events")
      .select("*")
      .eq("subject_user_id", label.user_id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={label.label_name} description={label.business_email} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-2 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
          <p className="text-small">Contact: {label.contact_name}</p>
          <p className="text-small">Account: {profile?.account_status ?? "—"}</p>
          <AccountStatusForm userId={label.user_id} />
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
