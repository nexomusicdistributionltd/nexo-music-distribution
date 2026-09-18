import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageIntro } from "@/components/workspace/PageIntro";
import { EmptyState } from "@/components/ui/EmptyState";
import { reviewMusicVideoAction } from "./actions";

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
      .select("id, title, status, created_at, video_url, primary_artist_name, provider_release_id, provider_status, provider_error, admin_note")
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
      <VideoRequestList rows={videos ?? []} />
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


function VideoRequestList({
  rows,
}: {
  rows: Array<{
    id: string;
    title: string;
    status: string;
    created_at: string;
    video_url: string;
    primary_artist_name: string | null;
    provider_release_id: string | null;
    provider_status: string | null;
    provider_error: string | null;
    admin_note: string | null;
  }>;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-h4">Music video distribution</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          Approve only after rights and metadata review. Provider access is checked during submission; no request is marked live without a provider status.
        </p>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <article
            key={row.id}
            className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{row.title}</p>
                <p className="text-caption text-[var(--nexo-text-muted)]">
                  {row.primary_artist_name || "Artist not set"} · {row.status}
                  {row.provider_status ? ` · Provider: ${row.provider_status}` : ""}
                </p>
              </div>
              <a
                href={row.video_url}
                rel="noreferrer"
                className="max-w-[28rem] truncate text-caption underline-offset-4 hover:underline"
              >
                Source video
              </a>
            </div>
            {row.provider_release_id ? (
              <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
                Provider release ID: {row.provider_release_id}
              </p>
            ) : null}
            {row.provider_error ? (
              <p className="mt-2 text-small text-[var(--nexo-error)]">{row.provider_error}</p>
            ) : null}
            {row.admin_note ? (
              <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
                Review note: {row.admin_note}
              </p>
            ) : null}

            <form action={reviewMusicVideoAction} className="mt-4 flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={row.id} />
              <input
                name="note"
                placeholder="Review note / requested changes"
                className="h-10 min-w-[16rem] flex-1 rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-3 text-small"
              />
              {row.provider_release_id ? (
                <button
                  type="submit"
                  name="decision"
                  value="sync"
                  className="h-10 rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] px-3 text-small font-medium"
                >
                  Sync provider
                </button>
              ) : (
                <button
                  type="submit"
                  name="decision"
                  value="approve"
                  className="h-10 rounded-[var(--nexo-radius)] bg-[var(--nexo-primary)] px-3 text-small font-medium [color:var(--nexo-primary-fg)]"
                >
                  Approve & distribute
                </button>
              )}
              <button
                type="submit"
                name="decision"
                value="reject"
                className="h-10 rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] px-3 text-small font-medium"
              >
                Reject / changes
              </button>
            </form>
          </article>
        ))}
      </div>
    </section>
  );
}
