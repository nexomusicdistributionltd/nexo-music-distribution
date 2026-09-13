import type { Metadata } from "next";
import Link from "next/link";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { ReleaseStatusBadge } from "@/components/releases/ReleaseStatusBadge";
import { StatCard } from "@/components/releases/StatCard";
import { Alert } from "@/components/ui/Alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequireRole } from "@/lib/auth/guards";
import {
  countUnreadNotifications,
  getReleaseCounts,
  listNotifications,
  listRecentReleases,
} from "@/lib/releases/queries";
import type { ReleaseStatus } from "@/lib/releases/types";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const ctx = await RequireRole(["artist", "label"]);
  const name = ctx.profile?.display_name || ctx.profile?.full_name || "there";

  let counts = {
    total: 0,
    drafts: 0,
    submittedQc: 0,
    approved: 0,
    deliveredLive: 0,
    rejectedAction: 0,
  };
  let recent: Awaited<ReturnType<typeof listRecentReleases>> = [];
  let notifications: Awaited<ReturnType<typeof listNotifications>> = [];
  let unread = 0;
  let loadError: string | null = null;

  try {
    [counts, recent, notifications, unread] = await Promise.all([
      getReleaseCounts(ctx.userId),
      listRecentReleases(ctx.userId, 5),
      listNotifications(ctx.userId, 5),
      countUnreadNotifications(ctx.userId),
    ]);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load dashboard data.";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h2">Dashboard</h1>
          <p className="mt-1 text-small text-[var(--nexo-text-muted)]">Welcome back, {name}.</p>
        </div>
        <Link
          href="/dashboard/releases/new"
          className="inline-flex h-10 items-center rounded-[var(--nexo-radius)] bg-[var(--nexo-primary)] px-4 text-small font-medium text-[var(--nexo-primary-fg)]"
        >
          Create release
        </Link>
      </div>

      <ProviderBanner connected={false} />

      {loadError ? (
        <Alert variant="error" title="Dashboard data unavailable">
          {loadError} Ensure Batch 4 migrations have been applied.
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Drafts" value={counts.drafts} />
        <StatCard label="Submitted / QC" value={counts.submittedQc} />
        <StatCard label="Approved" value={counts.approved} hint="Not delivered" />
        <StatCard label="Delivered / Live" value={counts.deliveredLive} hint="Requires provider" />
        <StatCard label="Action required" value={counts.rejectedAction} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent releases</CardTitle>
            <Link href="/dashboard/releases" className="text-caption underline-offset-4 hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <EmptyState
                title="No releases yet"
                description="Create your first single, EP, or album to get started."
                action={
                  <Link
                    href="/dashboard/releases/new"
                    className="inline-flex h-10 items-center rounded-[var(--nexo-radius)] bg-[var(--nexo-primary)] px-4 text-small font-medium text-[var(--nexo-primary-fg)]"
                  >
                    Create release
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-[var(--nexo-divider)]">
                {recent.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/releases/${r.id}`}
                        className="truncate font-medium hover:underline"
                      >
                        {r.title || "Untitled draft"}
                      </Link>
                      <p className="text-caption text-[var(--nexo-text-muted)]">
                        {r.primary_artist_name} · {r.release_type}
                      </p>
                    </div>
                    <ReleaseStatusBadge status={r.status as ReleaseStatus} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Notifications {unread ? `(${unread} unread)` : ""}</CardTitle>
            <Link
              href="/dashboard/notifications"
              className="text-caption underline-offset-4 hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <EmptyState
                title="No notifications"
                description="Status changes and QC updates will appear here."
              />
            ) : (
              <ul className="divide-y divide-[var(--nexo-divider)]">
                {notifications.map((n) => (
                  <li key={n.id} className="py-3">
                    <p className={`text-small ${n.read_at ? "text-[var(--nexo-text-muted)]" : "font-medium"}`}>
                      {n.title}
                    </p>
                    <p className="text-caption text-[var(--nexo-text-muted)]">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
