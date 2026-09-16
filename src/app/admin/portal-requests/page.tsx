import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageIntro } from "@/components/workspace/PageIntro";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = {
  title: "Portal requests",
  robots: { index: false, follow: false },
};

export default async function AdminPortalRequestsPage() {
  await RequireAdmin();
  const supabase = await createClient();
  const [{ data: services }, { data: videos }, { data: payouts }] = await Promise.all([
    supabase
      .from("portal_service_requests")
      .select("id, kind, title, status, created_at, owner_user_id")
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("music_video_submissions")
      .select("id, title, status, created_at, video_url")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("payout_requests")
      .select("id, amount_minor, currency, status, created_at")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const empty =
    (services ?? []).length === 0 && (videos ?? []).length === 0 && (payouts ?? []).length === 0;

  return (
    <div className="space-y-6">
      <PageIntro
        title="Portal requests"
        description="Artist/label service, video, and payout requests. Status stays pending until staff act — no invented DSP connections."
      />
      {empty ? <EmptyState title="No portal requests" /> : null}
      <RequestList title="Services" rows={(services ?? []).map((r) => `${r.kind} · ${r.title} · ${r.status}`)} />
      <RequestList title="Videos" rows={(videos ?? []).map((r) => `${r.title} · ${r.status}`)} />
      <RequestList
        title="Payout requests"
        rows={(payouts ?? []).map((r) => `${r.amount_minor} ${r.currency} · ${r.status}`)}
      />
    </div>
  );
}

function RequestList({ title, rows }: { title: string; rows: string[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-h4">{title}</h2>
      <ul className="divide-y divide-[var(--nexo-divider)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
        {rows.map((row, i) => (
          <li key={`${title}-${i}`} className="px-4 py-3 text-small">
            {row}
          </li>
        ))}
      </ul>
    </section>
  );
}
