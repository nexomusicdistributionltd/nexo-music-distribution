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
import { ErrorState } from "@/components/ui/ErrorState";
import { formatMinorUnits } from "@/lib/finance/money";
import {
  OVERVIEW_HREFS,
  type BalanceOverview,
  type StreamOverviewRow,
  type StreamOverviewStatus,
} from "@/lib/portal/overview";
import { cn } from "@/lib/utils";
import * as SimpleIcons from "simple-icons";
import type { AnalyticsTrendPoint } from "@/lib/portal/analytics";

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
  streamTrend,
  totalStreams,
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
  streamTrend: AnalyticsTrendPoint[];
  totalStreams: number;
  balance: BalanceOverview;
  actionNeeded: { id: string; title: string }[];
  loadError: string | null;
}) {
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

      <section className="overflow-hidden rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] shadow-[var(--nexo-shadow-sm)]">
        <div className="grid gap-0 lg:grid-cols-[16rem_1fr]">
          <ul className="divide-y divide-[var(--nexo-divider)] border-b border-[var(--nexo-divider)] lg:border-b-0 lg:border-r">
            {streamRows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex items-center gap-2 text-small font-medium">
                  <DspLogo id={row.id} label={row.label} />
                  {row.label}
                </span>
                <span className="text-right">
                  <span className="block text-[0.65rem] uppercase tracking-wide text-[var(--nexo-text-muted)]">
                    Streams
                  </span>
                  <span className="text-small tabular-nums text-[var(--nexo-text-secondary)]">
                    {row.streams != null && row.streams > 0
                      ? row.streams.toLocaleString("en-US")
                      : row.status}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="flex min-h-[16rem] flex-col justify-center bg-[var(--nexo-chart-surface)] px-6 py-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--nexo-text-muted)]">
                  {streamStatus}
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">
                  {totalStreams > 0 ? totalStreams.toLocaleString("en-US") : "0"}
                </p>
                <p className="text-caption text-[var(--nexo-text-muted)]">verified streams</p>
              </div>
              {streamTrend.length > 0 ? (
                <p className="text-caption text-[var(--nexo-text-muted)]">
                  {streamTrend[0]?.date} → {streamTrend[streamTrend.length - 1]?.date}
                </p>
              ) : null}
            </div>
            <div className="mt-5">
              <StreamTrend points={streamTrend} />
            </div>
            <p className="mt-4 text-small text-[var(--nexo-text-secondary)]">{streamNote}</p>
          </div>
        </div>
        <div className="flex justify-center border-t border-[var(--nexo-divider)] px-4 py-4">
          <Pill href={OVERVIEW_HREFS.streams}>View streams data</Pill>
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



type SimpleIconShape = { title?: string; path?: string };
const SIMPLE_ICONS = SimpleIcons as unknown as Record<string, SimpleIconShape>;
const DSP_ICON_KEYS: Record<string, string> = {
  audiomack: "siAudiomack",
  spotify: "siSpotify",
  apple_music: "siApplemusic",
  youtube: "siYoutube",
  youtube_music: "siYoutubemusic",
  amazon: "siAmazonmusic",
  amazon_music: "siAmazonmusic",
  deezer: "siDeezer",
  tidal: "siTidal",
  pandora: "siPandora",
};

function DspLogo({ id, label }: { id: string; label: string }) {
  const icon = SIMPLE_ICONS[DSP_ICON_KEYS[id] ?? ""];
  if (!icon?.path) {
    return (
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--nexo-border)] text-[0.55rem] font-semibold"
        aria-hidden
      >
        {label.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={icon.title || label}
      className="h-5 w-5 shrink-0 fill-current"
    >
      <path d={icon.path} />
    </svg>
  );
}

function StreamTrend({ points }: { points: AnalyticsTrendPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="flex h-28 items-center justify-center rounded-[var(--nexo-radius)] border border-dashed border-[var(--nexo-chart-grid)] px-4 text-center text-caption text-[var(--nexo-text-muted)]">
        No verified trend data yet.
      </div>
    );
  }

  const values = points.map((point) => Math.max(0, Number(point.streams) || 0));
  const max = Math.max(...values, 1);
  const width = 600;
  const height = 150;
  const coords = points
    .map((point, index) => {
      const x = points.length === 1 ? 0 : (index / (points.length - 1)) * width;
      const y = height - (Math.max(0, point.streams) / max) * (height - 12) - 6;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div className="rounded-[var(--nexo-radius)] border border-[var(--nexo-chart-grid)] p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full" role="img" aria-label="Verified stream trend">
        <polyline
          points={coords}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
