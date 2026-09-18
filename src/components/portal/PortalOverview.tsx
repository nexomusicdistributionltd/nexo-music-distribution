import Link from "next/link";
import type { ReactNode } from "react";
import {
  Bell,
  CirclePlus,
  Disc3,
  HelpCircle,
  Music,
  Play,
  Sparkles,
  Video,
  Link2,
  BarChart3,
  WalletCards,
  ArrowUpRight,
} from "lucide-react";
import { CoverArt } from "@/components/workspace/CoverArt";
import { DspIcon } from "@/components/fanlink/DspIcon";
import { ErrorState } from "@/components/ui/ErrorState";
import { formatMinorUnits } from "@/lib/finance/money";
import {
  OVERVIEW_HREFS,
  type BalanceOverview,
  type StreamOverviewRow,
  type StreamOverviewStatus,
} from "@/lib/portal/overview";
import { cn } from "@/lib/utils";

export type OverviewThumb = { id: string; title: string; src: string | null };

export function PortalOverview({
  welcomeName,
  thumbs,
  unreadNotifications,
  unenrolledCount,
  enrollableCount,
  streamRows,
  streamStatus,
  streamNote,
  balance,
  actionNeeded,
  loadError,
}: {
  welcomeName: string;
  thumbs: OverviewThumb[];
  unreadNotifications: number;
  unenrolledCount: number;
  enrollableCount: number;
  streamRows: StreamOverviewRow[];
  streamStatus: StreamOverviewStatus;
  streamNote: string;
  balance: BalanceOverview;
  actionNeeded: { id: string; title: string }[];
  loadError: string | null;
}) {
  const chartRows = streamRows
    .filter((row) => row.streamCount != null && row.streamCount >= 0)
    .sort((a, b) => (b.streamCount ?? 0) - (a.streamCount ?? 0))
    .slice(0, 8);
  const maxStreamCount = chartRows.reduce(
    (max, row) => Math.max(max, row.streamCount ?? 0),
    0
  );
  const reportingPlatforms = streamRows.filter(
    (row) => row.streamCount != null || row.statementRows > 0
  ).length;

  return (
    <div className="relative space-y-4 pb-16">
      <section className="overflow-hidden rounded-[1.5rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] shadow-[var(--nexo-shadow-sm)]">
        <div className="relative p-6 sm:p-8">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--nexo-text)]/30 to-transparent" />
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[var(--nexo-text-muted)]">Nexo Music Workspace</p>
          <div className="mt-2 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Welcome back, {welcomeName}</h2>
              <p className="mt-2 max-w-2xl text-small text-[var(--nexo-text-secondary)]">Manage your catalog, distribution, fanlinks, analytics and royalties from one workspace.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <HeroAction href={OVERVIEW_HREFS.createRelease} icon={<CirclePlus className="h-4 w-4" />} primary>New release</HeroAction>
              <HeroAction href="/dashboard/fanlinks" icon={<Link2 className="h-4 w-4" />}>Fanlinks</HeroAction>
              <HeroAction href={OVERVIEW_HREFS.streams} icon={<BarChart3 className="h-4 w-4" />}>Analytics</HeroAction>
              <HeroAction href="/earnings/payouts" icon={<WalletCards className="h-4 w-4" />}>Payouts</HeroAction>
            </div>
          </div>
        </div>
      </section>

      {loadError ? (
        <ErrorState title="Dashboard unavailable" description={loadError} retryHref="/dashboard" />
      ) : null}

      {actionNeeded.length > 0 ? (
        <p className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-warning)]/30 bg-[var(--nexo-warning-bg)] px-4 py-3 text-small">
          {actionNeeded.length} release{actionNeeded.length === 1 ? "" : "s"} need action.{" "}
          <Link href="/dashboard/releases?status=changes_requested" className="font-medium underline-offset-4 hover:underline">
            Review catalog
          </Link>
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <QuickCard icon={<Link2 className="h-8 w-8" aria-hidden />} title="Fanlinks">
          <p className="min-h-[3.25rem] text-small text-[var(--nexo-text-secondary)]">Create and manage smart links for live releases and track fan engagement.</p>
          <Pill href="/dashboard/fanlinks" tone="accent">Open fanlinks</Pill>
        </QuickCard>

        <div className="sm:col-span-1 xl:col-span-3 grid gap-3 lg:grid-cols-3">
        <QuickCard
          icon={<Disc3 className="h-8 w-8 text-[#c45b9a]" aria-hidden />}
          title="My Catalog"
        >
          <div className="flex min-h-[3.25rem] items-center gap-3">
            {thumbs.length > 0 ? (
              <div className="flex items-center">
                {thumbs.slice(0, 4).map((t, i) => (
                  <span key={t.id} className={cn("relative", i > 0 && "-ml-2")} style={{ zIndex: 4 - i }}>
                    <CoverArt src={t.src} title={t.title} size={44} className="ring-2 ring-[var(--nexo-card)]" />
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-small text-[var(--nexo-text-muted)]">No releases yet.</p>
            )}
          </div>
          <Pill href={OVERVIEW_HREFS.releases}>View releases</Pill>
        </QuickCard>

        <QuickCard
          icon={<CirclePlus className="h-8 w-8 text-[#d08a2a]" aria-hidden />}
          title="New Release"
        >
          <div className="flex min-h-[3.25rem] items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-[var(--nexo-text)] [color:var(--nexo-text-inverse)]" aria-hidden>
              <Music className="h-5 w-5" />
            </span>
            <p className="text-small text-[var(--nexo-text-secondary)]">
              Create a release with a new or existing UPC
            </p>
          </div>
          <Pill href={OVERVIEW_HREFS.createRelease} tone="accent">
            Create release
          </Pill>
        </QuickCard>

        <QuickCard
          icon={<Video className="h-8 w-8 text-[#3b82c4]" aria-hidden />}
          title="New Music Video"
        >
          <div className="flex min-h-[3.25rem] items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-[var(--nexo-text)] [color:var(--nexo-text-inverse)]" aria-hidden>
              <Play className="h-5 w-5 fill-current" />
            </span>
            <p className="text-small text-[var(--nexo-text-secondary)]">
              Submit your music video for distribution
            </p>
          </div>
          <Pill href={OVERVIEW_HREFS.videos}>Upload music video</Pill>
        </QuickCard>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <QuickCard icon={<Bell className="h-8 w-8 text-[#4b6cb4]" aria-hidden />} title="Product updates">
          <p className="min-h-[3.25rem] text-small text-[var(--nexo-text-secondary)]">
            Get the scoop on our latest product features.
          </p>
          <Pill
            href={unreadNotifications > 0 ? "/dashboard/notifications" : OVERVIEW_HREFS.updates}
            badge={unreadNotifications > 0 ? unreadNotifications : undefined}
          >
            Check updates
          </Pill>
        </QuickCard>

        <QuickCard icon={<Sparkles className="h-8 w-8 text-[#8b5cf6]" aria-hidden />} title="Enrollments">
          <p className="min-h-[3.25rem] text-small text-[var(--nexo-text-secondary)]">
            View services available to your account. Unenrolled services: {unenrolledCount}
            <span className="text-[var(--nexo-text-muted)]"> / {enrollableCount}</span>
          </p>
          <Pill href={OVERVIEW_HREFS.enrollments}>View</Pill>
        </QuickCard>
      </div>

      <section className="overflow-hidden rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] shadow-[var(--nexo-shadow-sm)]">
        <div className="flex flex-col gap-2 border-b border-[var(--nexo-divider)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--nexo-text-muted)]">
              DSP analytics
            </p>
            <h3 className="mt-1 text-h4">Streaming performance</h3>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--nexo-border)] bg-[var(--nexo-bg)] px-3 py-1.5 text-caption font-medium">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                streamStatus === "LIVE"
                  ? "bg-[var(--nexo-success)]"
                  : streamStatus === "UNAVAILABLE"
                    ? "bg-[var(--nexo-error)]"
                    : "bg-[var(--nexo-text-muted)]"
              )}
              aria-hidden
            />
            {streamStatus === "LIVE" ? "Live reporting" : streamStatus === "CONNECTED" ? "Connected" : "Unavailable"}
          </span>
        </div>

        <div className="grid gap-0 lg:grid-cols-[18rem_1fr]">
          <ul className="divide-y divide-[var(--nexo-divider)] border-b border-[var(--nexo-divider)] lg:border-b-0 lg:border-r">
            {streamRows.map((row) => {
              const metric =
                row.streamCount != null
                  ? new Intl.NumberFormat("en-US").format(row.streamCount)
                  : row.status === "UNAVAILABLE"
                    ? "Unavailable"
                    : row.statementRows > 0
                      ? "Reporting"
                      : "Awaiting report";
              return (
                <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <span className="flex min-w-0 items-center gap-3 text-small font-medium">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--nexo-border)] bg-[var(--nexo-bg)]">
                      <DspIcon name={row.id} className="h-[1.125rem] w-[1.125rem]" />
                    </span>
                    <span className="truncate">{row.label}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[var(--nexo-text-muted)]">
                      Streams
                    </span>
                    <span className="block text-small font-medium tabular-nums text-[var(--nexo-text-secondary)]">
                      {metric}
                    </span>
                    {row.trendPercent != null ? (
                      <span
                        className={cn(
                          "block text-[0.65rem] font-semibold tabular-nums",
                          row.trendPercent > 0
                            ? "text-[var(--nexo-success)]"
                            : row.trendPercent < 0
                              ? "text-[var(--nexo-error)]"
                              : "text-[var(--nexo-text-muted)]"
                        )}
                        title="Change from the provider's reported trend or consecutive dated reporting periods"
                      >
                        {row.trendPercent > 0 ? "+" : ""}
                        {new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(row.trendPercent)}%
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="min-h-[22rem] bg-[var(--nexo-chart-surface)] p-5 sm:p-6">
            {chartRows.length > 0 && maxStreamCount > 0 ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-caption font-medium text-[var(--nexo-text-secondary)]">
                      Reported stream mix
                    </p>
                    <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                      Relative performance from explicit stream/play metrics returned for this catalog.
                    </p>
                  </div>
                  <p className="text-caption tabular-nums text-[var(--nexo-text-muted)]">
                    {reportingPlatforms} platform{reportingPlatforms === 1 ? "" : "s"} reporting
                  </p>
                </div>
                <div className="space-y-4">
                  {chartRows.map((row) => {
                    const value = row.streamCount ?? 0;
                    const width = maxStreamCount > 0 ? Math.max(2, (value / maxStreamCount) * 100) : 0;
                    return (
                      <div key={`mix-${row.id}`} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3 text-caption">
                          <span className="flex min-w-0 items-center gap-2 font-medium">
                            <DspIcon name={row.id} className="h-4 w-4 shrink-0" />
                            <span className="truncate">{row.label}</span>
                          </span>
                          <span className="tabular-nums text-[var(--nexo-text-secondary)]">
                            {new Intl.NumberFormat("en-US").format(value)}
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-[var(--nexo-chart-grid)]">
                          <div
                            className="h-full rounded-full bg-[var(--nexo-text)] transition-[width]"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="border-t border-[var(--nexo-divider)] pt-4 text-caption leading-5 text-[var(--nexo-text-muted)]">
                  {streamNote}
                </p>
              </div>
            ) : (
              <div className="flex min-h-[19rem] items-center justify-center">
                <div className="max-w-md text-center">
                  <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--nexo-border)] bg-[var(--nexo-bg)]">
                    <BarChart3 className="h-5 w-5" aria-hidden />
                  </span>
                  <h4 className="mt-4 text-h4">
                    {streamStatus === "UNAVAILABLE" ? "Analytics temporarily unavailable" : "Analytics connection ready"}
                  </h4>
                  <p className="mt-2 text-small leading-6 text-[var(--nexo-text-secondary)]">
                    {streamNote}
                  </p>
                  <p className="mt-3 text-caption text-[var(--nexo-text-muted)]">
                    No zeros are generated when a DSP has not supplied a stream metric.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--nexo-divider)] px-4 py-4">
          <p className="hidden text-caption text-[var(--nexo-text-muted)] sm:block">
            Audiomack · Spotify · Apple Music · YouTube · Amazon · Deezer · TIDAL · Pandora
          </p>
          <Pill href={OVERVIEW_HREFS.streams}>Open analytics</Pill>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 shadow-[var(--nexo-shadow-sm)]">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--nexo-text-muted)]">
            Catalog activity
          </p>
          {thumbs.length === 0 ? (
            <p className="mt-6 text-small text-[var(--nexo-text-muted)]">
              No catalog activity yet. Create a release to get started.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {thumbs.slice(0, 4).map((t) => (
                <li key={t.id}>
                  <Link
                    href={`${OVERVIEW_HREFS.releases}/${t.id}`}
                    className="flex items-center gap-3 rounded-[var(--nexo-radius)] px-1 py-1 hover:bg-[var(--nexo-ghost-hover)]"
                  >
                    <CoverArt src={t.src} title={t.title} size={36} />
                    <span className="truncate text-small">{t.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 shadow-[var(--nexo-shadow-sm)]">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-h4">Account Balance</h3>
            <p className="text-caption text-[var(--nexo-text-muted)]">
              Reporting period: {balance.periodLabel ?? "—"}
            </p>
          </div>
          <dl className="mt-4 space-y-2 text-small">
            <BalanceRow label="Opening balance" value={moneyOrDash(balance.openingMinor, balance.currency)} />
            <BalanceRow
              label="Earnings (after taxes)"
              value={moneyOrDash(balance.earningsMinor, balance.currency)}
            />
            <BalanceRow label="Adjustments" value={moneyOrDash(balance.adjustmentsMinor, balance.currency)} />
            <BalanceRow label="Payments" value={moneyOrDash(balance.paymentsMinor, balance.currency)} />
            <BalanceRow
              label="Outstanding balance"
              value={formatMinorUnits(balance.outstandingMinor, balance.currency)}
              emphasis
            />
          </dl>
          <p className="mt-3 text-caption text-[var(--nexo-text-muted)]">{balance.note}</p>
          <div className="mt-4">
            <Pill href={OVERVIEW_HREFS.royalties}>View royalties</Pill>
          </div>
        </section>
      </div>

      <Link
        href={OVERVIEW_HREFS.support}
        className="fixed bottom-5 right-5 z-20 inline-flex items-center gap-2 rounded-full bg-[var(--nexo-success)] px-4 py-2.5 text-small font-medium text-white shadow-[var(--nexo-shadow)] hover:opacity-90"
      >
        <HelpCircle className="h-4 w-4" aria-hidden />
        Help
      </Link>
    </div>
  );
}

function HeroAction({ href, icon, children, primary = false }: { href: string; icon: ReactNode; children: ReactNode; primary?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex h-10 items-center gap-2 rounded-full border px-4 text-small font-semibold transition-transform hover:-translate-y-0.5", primary ? "border-[var(--nexo-text)] bg-[var(--nexo-text)] [color:var(--nexo-text-inverse)]" : "border-[var(--nexo-border)] bg-[var(--nexo-bg)] hover:bg-[var(--nexo-ghost-hover)]")}>
      {icon}{children}<ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
    </Link>
  );
}

function moneyOrDash(amount: number | null, currency: string) {
  if (amount == null) return "—";
  return formatMinorUnits(amount, currency);
}

function QuickCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 shadow-[var(--nexo-shadow-sm)]">
      <div className="mb-4 flex items-center gap-3">
        {icon}
        <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--nexo-text-muted)]">
          {title}
        </h3>
      </div>
      <div className="flex flex-1 flex-col gap-4">{children}</div>
    </section>
  );
}

function Pill({
  href,
  children,
  tone = "dark",
  badge,
}: {
  href: string;
  children: ReactNode;
  tone?: "dark" | "accent";
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-9 w-fit items-center gap-2 rounded-full px-4 text-[0.7rem] font-semibold uppercase tracking-[0.08em]",
        tone === "accent"
          ? "bg-[var(--nexo-success)] text-white hover:opacity-90"
          : "bg-[var(--nexo-text)] [color:var(--nexo-text-inverse)] hover:opacity-90"
      )}
    >
      {children}
      <span aria-hidden>›</span>
      {badge != null ? (
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--nexo-error)] px-1 text-[0.6rem] text-white">
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function BalanceRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[var(--nexo-text-secondary)]">{label}</dt>
      <dd className={cn("tabular-nums", emphasis ? "text-h4" : "")}>{value}</dd>
    </div>
  );
}

