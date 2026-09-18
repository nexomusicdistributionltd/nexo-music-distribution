import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  BarChart3,
  CircleAlert,
  CirclePlus,
  Disc3,
  RadioTower,
  UserRoundPlus,
  Users,
  WalletCards,
} from "lucide-react";

type LabelReleaseCounts = {
  total: number;
  drafts: number;
  submittedQc: number;
  approved: number;
  deliveredLive: number;
  rejectedAction: number;
};

type LabelRosterSummary = {
  id: string;
  name: string;
  country: string | null;
  releaseCount: number;
};

export function LabelOverviewPanel({
  labelName,
  roster,
  counts,
  memberCount,
}: {
  labelName: string;
  roster: LabelRosterSummary[];
  counts: LabelReleaseCounts;
  memberCount: number;
}) {
  const stats = [
    {
      label: "Roster artists",
      value: roster.length,
      href: "/app/artists",
      icon: Users,
      note: "Managed artist profiles",
    },
    {
      label: "Catalog releases",
      value: counts.total,
      href: "/dashboard/releases",
      icon: Disc3,
      note: "All label-owned releases",
    },
    {
      label: "Delivered / live",
      value: counts.deliveredLive,
      href: "/dashboard/releases",
      icon: RadioTower,
      note: "Delivering, delivered or live",
    },
    {
      label: "Needs action",
      value: counts.rejectedAction,
      href: "/dashboard/releases",
      icon: CircleAlert,
      note: "Changes, rejection or takedown",
    },
    {
      label: "Team records",
      value: memberCount,
      href: "/account/members",
      icon: Users,
      note: "Label member records",
    },
  ];

  const pipeline = [
    ["Drafts", counts.drafts],
    ["Submitted / QC", counts.submittedQc],
    ["Approved / scheduled", counts.approved],
    ["Delivering / live", counts.deliveredLive],
    ["Needs action", counts.rejectedAction],
  ] as const;

  return (
    <section className="space-y-4">
      <div className="overflow-hidden rounded-[1.5rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] shadow-[var(--nexo-shadow-sm)]">
        <div className="p-6 sm:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--nexo-text-muted)]">
                Label operations
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
                {labelName}
              </h2>
              <p className="mt-2 max-w-2xl text-small text-[var(--nexo-text-secondary)]">
                Manage roster artists, releases, sales, analytics, royalties and account operations from the label workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Action href="/app/artists/new" icon={<UserRoundPlus className="h-4 w-4" />}>
                Add artist
              </Action>
              <Action href="/dashboard/releases/new" icon={<CirclePlus className="h-4 w-4" />} primary>
                New release
              </Action>
              <Action href="/sales" icon={<BarChart3 className="h-4 w-4" />}>
                Sales
              </Action>
              <Action href="/earnings" icon={<WalletCards className="h-4 w-4" />}>
                Royalties
              </Action>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 shadow-[var(--nexo-shadow-sm)] transition hover:border-[var(--nexo-border-strong)]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--nexo-elevated)]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <ArrowUpRight className="h-4 w-4 text-[var(--nexo-text-muted)]" aria-hidden />
              </div>
              <p className="mt-4 text-3xl font-semibold tabular-nums">{stat.value.toLocaleString("en-US")}</p>
              <p className="mt-1 text-small font-medium">{stat.label}</p>
              <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">{stat.note}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 shadow-[var(--nexo-shadow-sm)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-h4">Roster activity</h3>
              <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                Release counts come from this label account&apos;s Nexo catalog.
              </p>
            </div>
            <Link href="/app/artists" className="text-small font-medium underline-offset-4 hover:underline">
              View roster
            </Link>
          </div>

          {roster.length === 0 ? (
            <div className="mt-5 rounded-[var(--nexo-radius)] border border-dashed border-[var(--nexo-border)] p-5">
              <p className="text-small text-[var(--nexo-text-secondary)]">
                No roster artists yet. Add an artist before creating a label release.
              </p>
              <Link
                href="/app/artists/new"
                className="mt-3 inline-flex h-9 items-center rounded-full bg-[var(--nexo-text)] px-4 text-caption font-semibold [color:var(--nexo-text-inverse)]"
              >
                Add first artist
              </Link>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--nexo-divider)]">
              {roster.slice(0, 6).map((artist) => (
                <li key={artist.id} className="flex flex-col gap-3 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Link
                      href={`/app/artists/${artist.id}`}
                      className="truncate text-small font-semibold underline-offset-4 hover:underline"
                    >
                      {artist.name}
                    </Link>
                    <p className="mt-0.5 text-caption text-[var(--nexo-text-muted)]">
                      {artist.country || "Country not set"} · {artist.releaseCount} release{artist.releaseCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      href={`/dashboard/releases/new?artist=${encodeURIComponent(artist.id)}`}
                      className="inline-flex h-8 items-center rounded-full border border-[var(--nexo-border)] px-3 text-caption font-medium hover:bg-[var(--nexo-ghost-hover)]"
                    >
                      New release
                    </Link>
                    <Link
                      href={`/app/artists/${artist.id}`}
                      className="inline-flex h-8 items-center rounded-full bg-[var(--nexo-text)] px-3 text-caption font-medium [color:var(--nexo-text-inverse)]"
                    >
                      Open
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 shadow-[var(--nexo-shadow-sm)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-h4">Catalog pipeline</h3>
              <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                Current Nexo release workflow state.
              </p>
            </div>
            <Link href="/analytics" className="text-small font-medium underline-offset-4 hover:underline">
              Analytics
            </Link>
          </div>
          <dl className="mt-4 space-y-1">
            {pipeline.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 rounded-[var(--nexo-radius)] px-3 py-2.5 hover:bg-[var(--nexo-ghost-hover)]"
              >
                <dt className="text-small text-[var(--nexo-text-secondary)]">{label}</dt>
                <dd className="text-small font-semibold tabular-nums">{value.toLocaleString("en-US")}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              href="/sales"
              className="inline-flex h-9 items-center justify-center rounded-full border border-[var(--nexo-border)] text-caption font-semibold hover:bg-[var(--nexo-ghost-hover)]"
            >
              Sales reports
            </Link>
            <Link
              href="/earnings/payouts"
              className="inline-flex h-9 items-center justify-center rounded-full border border-[var(--nexo-border)] text-caption font-semibold hover:bg-[var(--nexo-ghost-hover)]"
            >
              Payouts
            </Link>
          </div>
        </section>
      </div>
    </section>
  );
}

function Action({
  href,
  icon,
  children,
  primary = false,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "inline-flex h-10 items-center gap-2 rounded-full border border-[var(--nexo-text)] bg-[var(--nexo-text)] px-4 text-small font-semibold [color:var(--nexo-text-inverse)]"
          : "inline-flex h-10 items-center gap-2 rounded-full border border-[var(--nexo-border)] bg-[var(--nexo-bg)] px-4 text-small font-semibold hover:bg-[var(--nexo-ghost-hover)]"
      }
    >
      {icon}
      {children}
    </Link>
  );
}
