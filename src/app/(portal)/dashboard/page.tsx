import type { Metadata } from "next";
import Link from "next/link";
import { CoverArt } from "@/components/workspace/CoverArt";
import { CompactStat } from "@/components/workspace/CompactStat";
import { PageIntro } from "@/components/workspace/PageIntro";
import { ReleaseStatusBadge } from "@/components/releases/ReleaseStatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { RequireRole } from "@/lib/auth/guards";
import { artistNameOf } from "@/lib/auth/types";
import { formatMinorUnits } from "@/lib/finance/money";
import { mapArtworkUrls } from "@/lib/releases/artwork";
import {
  countUnreadNotifications,
  getReleaseCounts,
  listActionNeededReleases,
  listNotifications,
  listRecentReleases,
} from "@/lib/releases/queries";
import type { ReleaseStatus } from "@/lib/releases/types";
import {
  countReleasesForArtists,
  getArtistProfileForUser,
  getLabelProfileForUser,
  listRosterArtists,
} from "@/lib/roster/queries";
import { createClient } from "@/lib/supabase/server";
import { PlanFeaturesPanel } from "@/components/billing/PlanFeaturesPanel";
import { safeGetEntitlementsForAuth } from "@/lib/billing/queries";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const ctx = await RequireRole(["artist", "label"]);
  const isLabel = ctx.roles.includes("label");
  const name = ctx.profile?.display_name || ctx.profile?.full_name || "there";
  const entitlements = await safeGetEntitlementsForAuth(ctx);

  let counts = {
    total: 0,
    drafts: 0,
    submittedQc: 0,
    approved: 0,
    deliveredLive: 0,
    rejectedAction: 0,
  };
  let recent: Awaited<ReturnType<typeof listRecentReleases>> = [];
  let actionNeeded: Awaited<ReturnType<typeof listActionNeededReleases>> = [];
  let notifications: Awaited<ReturnType<typeof listNotifications>> = [];
  let unread = 0;
  let loadError: string | null = null;
  let earnings: Array<{ currency: string; available_minor: number; pending_minor: number }> = [];
  let ticketCount = 0;
  let trackCount = 0;

  try {
    const supabase = await createClient();
    const [c, rec, act, notes, unreadCount, balances, tickets, tracksHead] = await Promise.all([
      getReleaseCounts(ctx.userId),
      listRecentReleases(ctx.userId, 6),
      listActionNeededReleases(ctx.userId, 6),
      listNotifications(ctx.userId, 5),
      countUnreadNotifications(ctx.userId),
      supabase.from("ledger_balances").select("currency, available_minor, pending_minor").eq("owner_user_id", ctx.userId),
      supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("requester_user_id", ctx.userId)
        .in("status", ["open", "pending", "awaiting_user"]),
      supabase
        .from("release_tracks")
        .select("id, releases!inner(owner_user_id)", { count: "exact", head: true })
        .eq("releases.owner_user_id", ctx.userId),
    ]);
    counts = c;
    recent = rec;
    actionNeeded = act;
    notifications = notes;
    unread = unreadCount;
    earnings = (balances.data ?? []) as typeof earnings;
    ticketCount = tickets.count ?? 0;
    trackCount = tracksHead.error ? 0 : tracksHead.count ?? 0;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load dashboard data.";
  }

  const artwork = await mapArtworkUrls(recent.map((r) => r.id)).catch(() => ({} as Record<string, string | null>));

  if (isLabel) {
    const label = await getLabelProfileForUser(ctx.userId);
    const roster = label?.id ? await listRosterArtists(label.id) : [];
    const rosterCounts = await countReleasesForArtists(roster.map((a) => a.id));

    return (
      <div className="space-y-8">
        <PageIntro
          eyebrow="Label"
          title={label?.label_name || name}
          description="Roster, catalog, and distribution for this label account — not an artist login."
          actions={
            <>
              <Link
                href="/app/artists/new"
                className="inline-flex h-10 items-center rounded-[var(--nexo-radius)] border border-[var(--nexo-outline-border)] px-4 text-small font-medium"
              >
                Create artist
              </Link>
              <Link
                href="/dashboard/releases/new"
                className="inline-flex h-10 items-center rounded-[var(--nexo-radius)] bg-[var(--nexo-primary)] px-4 text-small font-medium [color:var(--nexo-primary-fg)]"
              >
                New release
              </Link>
            </>
          }
        />

        {loadError ? (
          <ErrorState title="Dashboard unavailable" description={loadError} retryHref="/dashboard" />
        ) : null}

        <PlanFeaturesPanel entitlements={entitlements} />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Link className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] px-4 py-3 text-small hover:bg-[var(--nexo-ghost-hover)]" href="/dashboard/playlist-pitch">
            Playlist pitching
          </Link>
          <Link className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] px-4 py-3 text-small hover:bg-[var(--nexo-ghost-hover)]" href="/dashboard/videos">
            Upload Music Video
          </Link>
          <Link className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] px-4 py-3 text-small hover:bg-[var(--nexo-ghost-hover)]" href="/analytics/streams">
            Streams (statement-backed)
          </Link>
          <Link className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] px-4 py-3 text-small hover:bg-[var(--nexo-ghost-hover)]" href="/app/artists">
            DSP profile links on roster
          </Link>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <CompactStat label="Roster" value={roster.length} href="/app/artists" />
          <CompactStat label="Releases" value={counts.total} href="/dashboard/releases" />
          <CompactStat label="Tracks" value={trackCount} href="/dashboard/releases" />
          <CompactStat
            label="Live / delivered"
            value={counts.deliveredLive}
            href="/dashboard/releases?status=live"
            hint="Confirmed delivery only"
          />
          <CompactStat
            label="Streams"
            value="—"
            hint="Placeholder until statement ingest"
          />
          <CompactStat
            label="Needs action"
            value={counts.rejectedAction}
            href="/dashboard/releases?status=changes_requested"
            tone={counts.rejectedAction ? "warning" : "default"}
          />
        </section>

        <DistributionPipeline counts={counts} />

        <div className="grid gap-6 xl:grid-cols-5">
          <section className="space-y-3 xl:col-span-3">
            <SectionHead title="Roster" href="/app/artists" />
            {roster.length === 0 ? (
              <EmptyState
                title="No artists on the roster"
                description="Create a managed artist profile. This does not convert the Label account or create a login."
                action={
                  <Link
                    href="/app/artists/new"
                    className="inline-flex h-10 items-center rounded-[var(--nexo-radius)] bg-[var(--nexo-primary)] px-4 text-small font-medium [color:var(--nexo-primary-fg)]"
                  >
                    Create artist
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-[var(--nexo-divider)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
                {roster.slice(0, 8).map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/app/artists/${a.id}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--nexo-ghost-hover)]"
                    >
                      <CoverArt src={a.avatar_url} title={a.artist_name || a.stage_name} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-small font-medium">
                          {a.artist_name || a.stage_name}
                        </span>
                        <span className="text-caption text-[var(--nexo-text-muted)]">
                          {rosterCounts[a.id] ?? 0} release{(rosterCounts[a.id] ?? 0) === 1 ? "" : "s"}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <OverviewSide
            recent={recent}
            artwork={artwork}
            actionNeeded={actionNeeded}
            notifications={notifications}
            unread={unread}
            earnings={earnings}
            ticketCount={ticketCount}
          />
        </div>
      </div>
    );
  }

  const artist = await getArtistProfileForUser(ctx.userId);
  const identity = artist ? artistNameOf(artist) : name;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Artist"
        title={identity}
        description="Your catalog, QC status, and royalties — no estimated streams or invented revenue."
        actions={
          <Link
            href="/dashboard/releases/new"
            className="inline-flex h-10 items-center rounded-[var(--nexo-radius)] bg-[var(--nexo-primary)] px-4 text-small font-medium [color:var(--nexo-primary-fg)]"
          >
            New release
          </Link>
        }
      />

      {loadError ? (
        <ErrorState title="Dashboard unavailable" description={loadError} retryHref="/dashboard" />
      ) : null}

      <PlanFeaturesPanel entitlements={entitlements} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] px-4 py-3 text-small hover:bg-[var(--nexo-ghost-hover)]" href="/dashboard/playlist-pitch">
          Playlist pitching
        </Link>
        <Link className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] px-4 py-3 text-small hover:bg-[var(--nexo-ghost-hover)]" href="/dashboard/videos">
          Upload Music Video
        </Link>
        <Link className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] px-4 py-3 text-small hover:bg-[var(--nexo-ghost-hover)]" href="/analytics/streams">
          Streams (statement-backed)
        </Link>
        <Link className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] px-4 py-3 text-small hover:bg-[var(--nexo-ghost-hover)]" href="/dashboard/profile">
          DSP profile links
        </Link>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <CompactStat label="Releases" value={counts.total} href="/dashboard/releases" />
        <CompactStat label="Tracks" value={trackCount} href="/dashboard/releases" />
        <CompactStat label="Drafts" value={counts.drafts} href="/dashboard/releases?status=draft" />
        <CompactStat
          label="Live / delivered"
          value={counts.deliveredLive}
          href="/dashboard/releases?status=live"
          hint="Confirmed delivery only"
        />
        <CompactStat
          label="Streams"
          value="—"
          hint="Placeholder until statement ingest"
        />
        <CompactStat
          label="Needs action"
          value={counts.rejectedAction}
          href="/dashboard/releases?status=changes_requested"
          tone={counts.rejectedAction ? "warning" : "default"}
        />
      </section>

      <DistributionPipeline counts={counts} />

      <div className="grid gap-6 xl:grid-cols-5">
        <section className="space-y-3 xl:col-span-3">
          <SectionHead title="Recent releases" href="/dashboard/releases" />
          {recent.length === 0 ? (
            <EmptyState
              title="No releases yet"
              description="Create a single, EP, or album. Listener and revenue charts stay empty until real statements exist."
              action={
                <Link
                  href="/dashboard/releases/new"
                  className="inline-flex h-10 items-center rounded-[var(--nexo-radius)] bg-[var(--nexo-primary)] px-4 text-small font-medium [color:var(--nexo-primary-fg)]"
                >
                  New release
                </Link>
              }
            />
          ) : (
            <ReleaseFeed items={recent} artwork={artwork} />
          )}
        </section>
        <OverviewSide
          recent={[]}
          artwork={artwork}
          actionNeeded={actionNeeded}
          notifications={notifications}
          unread={unread}
          earnings={earnings}
          ticketCount={ticketCount}
          hideRecent
        />
      </div>
    </div>
  );
}

function DistributionPipeline({
  counts,
}: {
  counts: {
    drafts: number;
    submittedQc: number;
    approved: number;
    deliveredLive: number;
  };
}) {
  const steps = [
    { label: "Drafts", value: counts.drafts, href: "/dashboard/releases?status=draft" },
    { label: "In QC", value: counts.submittedQc, href: "/dashboard/releases?status=submitted" },
    { label: "Approved", value: counts.approved, href: "/dashboard/releases?status=approved" },
    { label: "Live", value: counts.deliveredLive, href: "/dashboard/releases?status=live" },
  ];
  return (
    <section className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] px-4 py-3">
      <p className="text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">
        Distribution status
      </p>
      <ol className="mt-3 grid gap-3 sm:grid-cols-4">
        {steps.map((s) => (
          <li key={s.label}>
            <Link href={s.href} className="block hover:opacity-80">
              <span className="text-caption text-[var(--nexo-text-muted)]">{s.label}</span>
              <span className="mt-0.5 block text-xl font-semibold tabular-nums">{s.value}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SectionHead({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-h4">{title}</h3>
      <Link href={href} className="text-caption text-[var(--nexo-text-muted)] underline-offset-4 hover:underline">
        View all
      </Link>
    </div>
  );
}

function ReleaseFeed({
  items,
  artwork,
}: {
  items: Awaited<ReturnType<typeof listRecentReleases>>;
  artwork: Record<string, string | null>;
}) {
  return (
    <ul className="divide-y divide-[var(--nexo-divider)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
      {items.map((r) => (
        <li key={r.id}>
          <Link
            href={`/dashboard/releases/${r.id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--nexo-ghost-hover)]"
          >
            <CoverArt src={artwork[r.id]} title={r.title || "Untitled"} size={44} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-small font-medium">{r.title || "Untitled draft"}</span>
              <span className="text-caption text-[var(--nexo-text-muted)]">
                {r.primary_artist_name} · {r.release_type}
              </span>
            </span>
            <ReleaseStatusBadge status={r.status as ReleaseStatus} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function OverviewSide({
  recent,
  artwork,
  actionNeeded,
  notifications,
  unread,
  earnings,
  ticketCount,
  hideRecent,
}: {
  recent: Awaited<ReturnType<typeof listRecentReleases>>;
  artwork: Record<string, string | null>;
  actionNeeded: Awaited<ReturnType<typeof listActionNeededReleases>>;
  notifications: Awaited<ReturnType<typeof listNotifications>>;
  unread: number;
  earnings: Array<{ currency: string; available_minor: number; pending_minor: number }>;
  ticketCount: number;
  hideRecent?: boolean;
}) {
  return (
    <aside className="space-y-6 xl:col-span-2">
      {!hideRecent && recent.length > 0 ? (
        <section className="space-y-3">
          <SectionHead title="Recent catalog" href="/dashboard/releases" />
          <ReleaseFeed items={recent} artwork={artwork} />
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-h4">Needs attention</h3>
        {actionNeeded.length === 0 ? (
          <p className="text-small text-[var(--nexo-text-muted)]">Nothing waiting on you.</p>
        ) : (
          <ul className="divide-y divide-[var(--nexo-divider)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
            {actionNeeded.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <Link href={`/dashboard/releases/${r.id}`} className="truncate text-small font-medium hover:underline">
                  {r.title || "Untitled"}
                </Link>
                <ReleaseStatusBadge status={r.status as ReleaseStatus} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <SectionHead title={unread ? `Messages (${unread} unread)` : "Notifications"} href="/dashboard/notifications" />
        {notifications.length === 0 ? (
          <p className="text-small text-[var(--nexo-text-muted)]">No notifications yet.</p>
        ) : (
          <ul className="space-y-2">
            {notifications.map((n) => (
              <li key={n.id} className={`text-small ${n.read_at ? "text-[var(--nexo-text-muted)]" : "font-medium"}`}>
                {n.title}
              </li>
            ))}
          </ul>
        )}
        <p className="text-caption text-[var(--nexo-text-muted)]">
          Open tickets: {ticketCount} ·{" "}
          <Link href="/support" className="underline-offset-4 hover:underline">
            Support
          </Link>
        </p>
      </section>

      <section className="space-y-3">
        <SectionHead title="Royalties" href="/earnings" />
        {earnings.length === 0 ? (
          <p className="text-small text-[var(--nexo-text-muted)]">
            No ledger balances yet. Nothing is estimated.
          </p>
        ) : (
          <ul className="space-y-2 text-small">
            {earnings.map((b) => (
              <li key={b.currency} className="tabular-nums">
                {formatMinorUnits(b.available_minor, b.currency)} available
                <span className="text-[var(--nexo-text-muted)]">
                  {" "}
                  · {formatMinorUnits(b.pending_minor, b.currency)} pending
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
