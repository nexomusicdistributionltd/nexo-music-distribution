import Link from "next/link";
import { notFound } from "next/navigation";
import { RequireVerifiedPortal } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageIntro } from "@/components/workspace/PageIntro";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { ServiceRequestForm } from "@/components/portal/ServiceRequestForm";
import { ServiceRequestRevisionForm } from "@/components/portal/ServiceRequestRevisionForm";
import {
  AssignmentForm,
  EnrollmentButton,
  MemberInviteForm,
  MusicVideoForm,
  PayeeForm,
  RecoupmentForm,
  TaxDetailsForm,
} from "@/components/portal/PortalForms";
import { DspProfileLinksEditor } from "@/components/roster/DspProfileLinksEditor";
import { DspIcon } from "@/components/fanlink/DspIcon";
import { ArtistBioForm } from "@/components/roster/ArtistBioForm";
import { findPortalItem, type PortalNavItem } from "@/lib/portal/ia";
import { knowledgeArticle, allKnowledgeArticles, type KnowledgeArticle } from "@/lib/portal/knowledge";
import { loadAnalyticsSnapshot } from "@/lib/portal/analytics";
import { ENROLLABLE_SERVICES, SERVICE_KIND_LABEL, isAnalyticsKey } from "@/lib/portal/service-kinds";
import { formatMinorUnits } from "@/lib/finance/money";
import { getPaymentConnectionState } from "@/lib/finance/payment";
import { getArtistProfileForUser, getLabelProfileForUser, listArtistDspLinks, listRosterArtists } from "@/lib/roster/queries";
import { listPublishedVideos } from "@/lib/website/queries";
import { workspaceKindForRoles } from "@/lib/auth/nav";
import { getEntitlementsForAuth } from "@/lib/billing/queries";
import { SplitShareRealtime } from "@/components/portal/SplitShareRealtime";
import { isFeatureUnlocked, pricingHrefForAccount } from "@/lib/billing/feature-access";
import { marketingServiceSpec } from "@/lib/marketing/services";
import { RealtimeRefresh } from "@/components/notifications/RealtimeRefresh";

async function loadReleases(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("releases")
    .select("id, title, primary_artist_name")
    .eq("owner_user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(40);
  return data ?? [];
}

export async function PortalFeaturePage({ href }: { href: string }) {
  const def = findPortalItem(href);
  if (!def) notFound();
  const ctx = await RequireVerifiedPortal();
  const kind = workspaceKindForRoles(ctx.roles);
  if (kind === "admin") notFound();
  if (def.visibility && def.visibility !== "all" && def.visibility !== kind) notFound();

  if (def.pageKind === "knowledge") {
    return <KnowledgeView def={def} userId={ctx.userId} />;
  }
  if (def.pageKind === "analytics") {
    if (!def.analyticsKey || !isAnalyticsKey(def.analyticsKey)) notFound();
    const entitlements = await getEntitlementsForAuth(ctx);
    if (!isFeatureUnlocked(entitlements, "advanced_analytics")) {
      return (
        <div className="space-y-6">
          <PageIntro eyebrow="Analytics" title={def.label} description={def.description} />
          <section className="rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6">
            <h2 className="text-h4">Advanced analytics requires an eligible plan</h2>
            <p className="mt-2 text-small text-[var(--nexo-text-muted)]">
              Upgrade to unlock detailed distribution analytics for this account.
            </p>
            <Link className="mt-4 inline-flex rounded-full bg-[var(--nexo-text)] px-4 py-2 text-small font-semibold [color:var(--nexo-text-inverse)]" href={pricingHrefForAccount(entitlements.accountType)}>
              View plans
            </Link>
          </section>
        </div>
      );
    }
    const snap = await loadAnalyticsSnapshot(ctx.userId, def.analyticsKey);
    const metricEntries = Object.entries(snap.metricTotals);
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="Analytics" title={def.label} description={def.description} />
        <Alert
          variant={
            snap.statusLabel === "LIVE"
              ? "success"
              : snap.statusLabel === "UNAVAILABLE"
                ? "warning"
                : "default"
          }
          title={snap.statusLabel}
        >
          {snap.note}
        </Alert>

        <dl className="grid gap-3 sm:grid-cols-3">
          <Stat label="Provider rows" value={String(snap.rowCount)} />
          <Stat
            label="Reported sources"
            value={snap.dspCodes.length > 0 ? snap.dspCodes.map(analyticsDspLabel).join(", ") : snap.connected ? "Connected" : "Unavailable"}
          />
          <Stat label="Last provider update" value={formatAnalyticsUpdatedAt(snap.updatedAt)} />
        </dl>

        {metricEntries.length > 0 ? (
          <section className="rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
            <h2 className="text-h4">Live metrics</h2>
            <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
              Metrics below are returned by the connected distribution analytics feed for this account&apos;s catalog.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {metricEntries.map(([metric, value]) => (
                <Stat key={metric} label={analyticsMetricLabel(metric)} value={formatAnalyticsMetric(metric, value)} />
              ))}
            </div>
          </section>
        ) : null}

        {def.analyticsKey === "streams" ? (
          <section className="rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
            <h2 className="text-h4">Streams by DSP</h2>
            <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
              Each card uses the latest stream value returned for the signed-in account&apos;s owned catalog. Missing provider data is shown as pending, never as a made-up zero.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {STREAM_ANALYTICS_DSPS.map((dsp) => {
                const streams = analyticsStreamValue(snap.streamCounts, dsp.aliases);
                const trend = analyticsTrendValue(snap.trendPercentByDsp, dsp.aliases);
                return (
                  <div
                    key={dsp.label}
                    className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"
                  >
                    <div className="flex items-center gap-2">
                      <DspIcon name={dsp.icon} className="h-5 w-5" />
                      <p className="truncate text-small font-medium">{dsp.label}</p>
                    </div>
                    <p className="mt-3 text-2xl font-semibold tabular-nums">
                      {streams == null ? "—" : new Intl.NumberFormat("en-US").format(streams)}
                    </p>
                    <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                      {streams == null
                        ? "Awaiting provider report"
                        : `streams${Number.isFinite(trend) ? ` · ${trend! > 0 ? "+" : ""}${trend!.toFixed(2)}%` : ""}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ) : Object.keys(snap.streamCounts).length > 0 ? (
          <section className="rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
            <h2 className="text-h4">Provider stream context</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(snap.streamCounts).map(([dsp, streams]) => {
                const iconName = analyticsDspIcon(dsp);
                const trend = snap.trendPercentByDsp[dsp];
                return (
                  <div
                    key={dsp}
                    className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"
                  >
                    <div className="flex items-center gap-2">
                      {iconName ? <DspIcon name={iconName} className="h-5 w-5" /> : null}
                      <p className="truncate text-small font-medium">{analyticsDspLabel(dsp)}</p>
                    </div>
                    <p className="mt-3 text-2xl font-semibold tabular-nums">
                      {new Intl.NumberFormat("en-US").format(streams)}
                    </p>
                    <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                      streams
                      {Number.isFinite(trend)
                        ? ` · ${trend > 0 ? "+" : ""}${trend.toFixed(2)}%`
                        : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {snap.rowCount === 0 && snap.statusLabel === "CONNECTED" ? (
          <section className="rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
            <h2 className="text-h4">Provider connected</h2>
            <p className="mt-2 text-small text-[var(--nexo-text-muted)]">
              This analytics source is live. Data will populate automatically when the provider reports activity for the account&apos;s distributed catalog.
            </p>
          </section>
        ) : null}
      </div>
    );
  }
  if (def.pageKind === "service") {
    const supabase = await createClient();
    const releases = await loadReleases(ctx.userId);
    const spec = marketingServiceSpec(def.serviceKind);
    const [{ data: rows }, { data: control }] = await Promise.all([
      supabase
        .from("portal_service_requests")
        .select("id, title, body, related_url, status, created_at, admin_note, provider_state, provider_reference, provider_url")
        .eq("owner_user_id", ctx.userId)
        .eq("kind", def.serviceKind)
        .order("created_at", { ascending: false })
        .limit(50),
      spec
        ? supabase
            .from("marketing_service_controls")
            .select("enabled, accepting_requests, requires_release, description")
            .eq("kind", def.serviceKind)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const acceptingRequests =
      !spec || !control || (Boolean(control.enabled) && Boolean(control.accepting_requests));
    const requiresRelease = Boolean(control?.requires_release ?? spec?.requiresRelease ?? false);
    const pageDescription = control?.description || spec?.guidance || def.description;

    return (
      <div className="space-y-6">
        <RealtimeRefresh userId={ctx.userId} />
        <PageIntro eyebrow={spec ? "Marketing" : "Request"} title={def.label} description={pageDescription} />

        {spec ? (
          <Alert
            variant={acceptingRequests ? "default" : "warning"}
            title={acceptingRequests ? "Live workflow" : "Requests paused"}
          >
            {acceptingRequests
              ? spec.providerMode === "internal"
                ? "This workflow is controlled by Nexo operations in real time. Only completed work and verified outcomes are shown."
                : "This workflow is connected to Nexo operations and the distribution-provider process. Provider status is shown only after a real submission or provider response exists."
              : "Nexo operations has temporarily stopped accepting new requests for this service. Existing requests continue to show their real status."}
          </Alert>
        ) : null}

        {acceptingRequests ? (
          <ServiceRequestForm
            kind={def.serviceKind!}
            titlePlaceholder={SERVICE_KIND_LABEL[def.serviceKind as keyof typeof SERVICE_KIND_LABEL] ?? def.label}
            releases={releases}
            requiresRelease={requiresRelease}
            guidance={spec?.guidance}
          />
        ) : null}

        {spec?.kind === "spotify_discovery_mode" ? (
          <Link
            href="/analytics/spotify-discovery"
            className="inline-flex text-small font-medium underline underline-offset-4"
          >
            View live Spotify Discovery Mode analytics
          </Link>
        ) : null}

        {(rows ?? []).length === 0 ? (
          <EmptyState
            title="No requests yet"
            description={acceptingRequests ? "Submit a request to start the real operations workflow." : "There are no existing requests for this service."}
          />
        ) : (
          <ul className="space-y-3">
            {(rows ?? []).map((r) => (
              <li key={r.id} className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{r.title}</p>
                  <span className="rounded-full border border-[var(--nexo-border)] px-2 py-1 text-caption uppercase tracking-wide">
                    {String(r.status).replace(/_/g, " ")}
                  </span>
                </div>
                {r.provider_state ? (
                  <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
                    Provider: {String(r.provider_state).replace(/_/g, " ")}
                  </p>
                ) : null}
                {r.provider_reference ? (
                  <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                    Provider reference: {r.provider_reference}
                  </p>
                ) : null}
                {r.provider_url ? (
                  <Link
                    href={r.provider_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex break-all text-caption underline underline-offset-4"
                  >
                    Open verified provider reference
                  </Link>
                ) : null}
                {r.body ? <p className="mt-2 text-small">{r.body}</p> : null}
                {r.related_url ? (
                  <p className="mt-1 break-all text-caption text-[var(--nexo-text-muted)]">{r.related_url}</p>
                ) : null}
                {r.admin_note ? (
                  <p className="mt-2 text-small text-[var(--nexo-text-muted)]">Nexo operations: {r.admin_note}</p>
                ) : null}
                {r.status === "needs_info" || r.status === "rejected" ? (
                  <ServiceRequestRevisionForm
                    requestId={r.id}
                    defaultBody={r.body}
                    defaultUrl={r.related_url}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  if (def.pageKind === "videos") return <VideosView userId={ctx.userId} />;
  if (def.pageKind === "tracks") return <TracksView userId={ctx.userId} />;
  if (def.pageKind === "payees") return <PayeesView userId={ctx.userId} />;
  if (def.pageKind === "assignments") return <AssignmentsView userId={ctx.userId} />;
  if (def.pageKind === "recoupments") return <RecoupmentsView userId={ctx.userId} />;
  if (def.pageKind === "members") return <MembersView isLabel={kind === "label"} userId={ctx.userId} />;
  if (def.pageKind === "enrollments") return <EnrollmentsView userId={ctx.userId} />;
  if (def.pageKind === "labels") return <LabelsView userId={ctx.userId} isLabel={kind === "label"} />;
  if (def.pageKind === "payment-tax") return <PaymentTaxView userId={ctx.userId} />;
  if (def.pageKind === "artist-self") return <ArtistSelfView userId={ctx.userId} />;

  notFound();
}

const STREAM_ANALYTICS_DSPS = [
  { label: "Audiomack", icon: "audiomack", aliases: ["audiomack"] },
  { label: "Spotify", icon: "spotify", aliases: ["spotify"] },
  { label: "Apple Music", icon: "apple_music", aliases: ["apple_music", "apple"] },
  { label: "YouTube", icon: "youtube", aliases: ["youtube"] },
  { label: "Amazon Music", icon: "amazon_music", aliases: ["amazon_music", "amazon"] },
  { label: "Deezer", icon: "deezer", aliases: ["deezer"] },
  { label: "Tidal", icon: "tidal", aliases: ["tidal"] },
  { label: "Pandora", icon: "pandora", aliases: ["pandora"] },
] as const;

function analyticsStreamValue(
  values: Record<string, number>,
  aliases: readonly string[]
): number | null {
  for (const [key, value] of Object.entries(values)) {
    if (aliases.some((alias) => key === alias || key.includes(alias))) return value;
  }
  return null;
}

function analyticsTrendValue(
  values: Record<string, number>,
  aliases: readonly string[]
): number | null {
  for (const [key, value] of Object.entries(values)) {
    if (aliases.some((alias) => key === alias || key.includes(alias))) return value;
  }
  return null;
}

function analyticsMetricLabel(metric: string): string {
  const labels: Record<string, string> = {
    streams: "Streams",
    downloads: "Downloads",
    video_creations: "Video creations",
    views: "Views",
    likes: "Likes",
    comments: "Comments",
    shares: "Shares",
    listeners: "Listeners",
    saves: "Saves",
    skips: "Skips",
    playlist_adds: "Playlist adds",
    first_time_listeners: "First-time listeners",
    discovery_mode_streams: "Discovery Mode streams",
    completion_rate: "Completion rate",
    shuffle_rate: "Shuffle rate",
    weekly_engagement: "Weekly engagement",
    hourly_engagement: "Hourly engagement",
    suspicious_streams: "Suspicious streams",
    artificial_streams: "Artificial / invalid streams",
    suspicious_rate: "Suspicious rate",
  };
  return labels[metric] ?? analyticsDspLabel(metric);
}

function formatAnalyticsMetric(metric: string, value: number): string {
  if (metric.endsWith("_rate")) return `${value.toFixed(2)}%`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function formatAnalyticsUpdatedAt(value: string | null): string {
  if (!value) return "Latest provider response";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(parsed);
}

function analyticsDspIcon(value: string): string | null {
  const dsp = value.toLowerCase();
  if (dsp.includes("spotify")) return "spotify";
  if (dsp.includes("apple")) return "apple_music";
  if (dsp.includes("youtube")) return "youtube";
  if (dsp.includes("amazon")) return "amazon_music";
  if (dsp.includes("deezer")) return "deezer";
  if (dsp.includes("tidal")) return "tidal";
  if (dsp.includes("pandora")) return "pandora";
  if (dsp.includes("audiomack")) return "audiomack";
  if (dsp.includes("soundcloud")) return "soundcloud";
  if (dsp.includes("tiktok")) return "tiktok";
  return null;
}

function analyticsDspLabel(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4">
      <p className="text-caption text-[var(--nexo-text-muted)]">{label}</p>
      <p className="mt-1 text-h4 tabular-nums">{value}</p>
    </div>
  );
}

async function KnowledgeView({
  def,
  userId,
}: {
  def: PortalNavItem;
  userId: string;
}) {
  let article = def.knowledgeSlug ? knowledgeArticle(def.knowledgeSlug) : undefined;
  const realtimeMarketingContent = new Set(["client-offerings", "marketing-best-practices"]);

  if (def.knowledgeSlug && realtimeMarketingContent.has(def.knowledgeSlug)) {
    const supabase = await createClient();
    const { data: page } = await supabase
      .from("marketing_content_pages")
      .select("slug, title, summary, sections, enabled")
      .eq("slug", def.knowledgeSlug)
      .maybeSingle();

    if (page && page.enabled === false) {
      return (
        <div className="space-y-4">
          <RealtimeRefresh userId={userId} />
          <PageIntro title={page.title || def.label} description="This marketing guide is temporarily unpublished by Nexo operations." />
          <EmptyState title="Content unavailable" description="Check back after Nexo operations republishes this page." />
        </div>
      );
    }

    if (page) {
      const sections = Array.isArray(page.sections)
        ? page.sections
            .map((value) => {
              if (!value || typeof value !== "object") return null;
              const row = value as Record<string, unknown>;
              const heading = typeof row.heading === "string" ? row.heading : "";
              const body = typeof row.body === "string" ? row.body : "";
              return heading && body ? { heading, body } : null;
            })
            .filter((value): value is { heading: string; body: string } => Boolean(value))
        : [];

      article = {
        slug: page.slug,
        title: page.title,
        summary: page.summary,
        sections,
      } satisfies KnowledgeArticle;
    }
  }

  if (!article) {
    return (
      <div className="space-y-4">
        <RealtimeRefresh userId={userId} />
        <PageIntro title={def.label} description={def.description} />
        <EmptyState title="Article unavailable" />
      </div>
    );
  }

  const others = allKnowledgeArticles().filter((a) => a.slug !== article.slug).slice(0, 6);
  return (
    <article className="space-y-6">
      <RealtimeRefresh userId={userId} />
      <PageIntro eyebrow="Help" title={article.title} description={article.summary} />
      {article.sections.map((s) => (
        <section key={s.heading} className="space-y-2">
          <h3 className="text-h4">{s.heading}</h3>
          <p className="max-w-2xl text-small text-[var(--nexo-text-secondary)]">{s.body}</p>
        </section>
      ))}
      {article.slug === "knowledge-base" || article.slug === "video-tutorials" ? (
        <RelatedHelp others={others} />
      ) : null}
    </article>
  );
}

function RelatedHelp({ others }: { others: { slug: string; title: string }[] }) {
  const hrefFor: Record<string, string> = {
    "marketing-best-practices": "/help/marketing-best-practices",
    "royalties-help": "/help/royalties",
    "splitshare-guide": "/splitshare/guide",
    "youtube-oac": "/help/youtube-oac",
    "copyright-your-music": "/help/copyright-your-music",
    "cover-song-licensing": "/help/cover-song-licensing",
    "copyrights-takedowns": "/help/copyrights-takedowns",
    dmca: "/help/dmca",
    "trust-and-safety": "/help/trust-and-safety",
    "knowledge-base": "/help/knowledge-base",
    "platform-overview": "/help/platform-overview",
    "release-creation": "/help/release-creation",
    "video-tutorials": "/help/video-tutorials",
    "client-offerings": "/marketing/offerings",
  };
  return (
    <ul className="space-y-2 text-small">
      {others.map((a) => (
        <li key={a.slug}>
          <Link href={hrefFor[a.slug] ?? `/help/${a.slug}`} className="underline-offset-4 hover:underline">
            {a.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function VideosView({ userId }: { userId: string }) {
  const supabase = await createClient();
  const releases = await loadReleases(userId);
  const [{ data: rows }, publicVideos] = await Promise.all([
    supabase
      .from("music_video_submissions")
      .select("id, title, video_url, status, created_at, admin_note, provider_release_id, provider_status, provider_error")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    listPublishedVideos({ limit: 12 }).catch(() => []),
  ]);
  return (
    <div className="space-y-6">
      <PageIntro
        title="Upload Music Video"
        description="Prepare a complete music-video package for Nexo review and connected-provider delivery. Music-video delivery remains subject to provider account eligibility."
      />
      <MusicVideoForm releases={releases} />
      {(rows ?? []).length === 0 ? (
        <EmptyState title="No video submissions" description="Paste a YouTube or Vimeo URL you control." />
      ) : (
        <ul className="space-y-3">
          {(rows ?? []).map((r) => (
            <li key={r.id} className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
              <p className="font-medium">{r.title}</p>
              <p className="text-caption text-[var(--nexo-text-muted)]">
                {r.status}
                {r.provider_status ? ` · Provider: ${r.provider_status}` : ""}
              </p>
              {r.provider_error ? (
                <p className="mt-1 text-caption text-[var(--nexo-error)]">{r.provider_error}</p>
              ) : null}
              {r.provider_release_id ? (
                <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                  Provider release ID: {r.provider_release_id}
                </p>
              ) : null}
              <a className="break-all text-small underline-offset-4 hover:underline" href={r.video_url} rel="noreferrer">
                {r.video_url}
              </a>
            </li>
          ))}
        </ul>
      )}
      {publicVideos.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-h4">Published Nexo videos</h3>
          <ul className="space-y-1 text-small">
            {publicVideos.slice(0, 8).map((v) => (
              <li key={v.id}>
                <a href={v.url} className="underline-offset-4 hover:underline" rel="noreferrer">
                  {v.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

async function TracksView({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("release_tracks")
    .select("id, title, isrc, track_number, releases!inner(id, title, owner_user_id)")
    .eq("releases.owner_user_id", userId)
    .order("track_number", { ascending: true })
    .limit(200);
  return (
    <div className="space-y-6">
      <PageIntro title="Tracks" description="Tracks in your catalog. Royalty lines appear after statements are posted." />
      {(data ?? []).length === 0 ? (
        <EmptyState
          title="No tracks yet"
          description="Create a release and add audio."
          action={
            <Link href="/dashboard/releases/new" className="underline">
              Create Release
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-[var(--nexo-divider)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
          {(data ?? []).map((t) => {
            const rel = t.releases as unknown as { id: string; title: string | null };
            return (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-small">
                <span>
                  {t.title || "Untitled"}
                  <span className="block text-caption text-[var(--nexo-text-muted)]">
                    {rel?.title || "Release"} {t.isrc ? `· ${t.isrc}` : ""}
                  </span>
                </span>
                {rel?.id ? (
                  <Link href={`/dashboard/releases/${rel.id}`} className="text-caption underline-offset-4 hover:underline">
                    Open
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

async function PayeesView({ userId }: { userId: string }) {
  const supabase = await createClient();
  const [{ data }, { data: allocations }] = await Promise.all([
    supabase
      .from("portal_payees")
      .select("id, name, email, role_label, status, admin_note, linked_user_id, created_at")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("splitshare_allocations")
      .select("payee_id, currency, payable_minor, status")
      .eq("owner_user_id", userId)
      .limit(1000),
  ]);

  const balances = new Map<string, Map<string, number>>();
  for (const allocation of allocations ?? []) {
    if (!allocation.payee_id || allocation.status === "owner" || allocation.status === "recouped") continue;
    const byCurrency = balances.get(allocation.payee_id) ?? new Map<string, number>();
    byCurrency.set(
      allocation.currency,
      (byCurrency.get(allocation.currency) ?? 0) + Number(allocation.payable_minor ?? 0)
    );
    balances.set(allocation.payee_id, byCurrency);
  }

  return (
    <div className="space-y-6">
      <SplitShareRealtime ownerUserId={userId} />
      <PageIntro
        title="Payees"
        description="Create payees by email. Admin review links matching Nexo accounts automatically; external payees can still accrue protected held balances."
      />
      <PayeeForm />
      {(data ?? []).length === 0 ? (
        <EmptyState title="No payees" />
      ) : (
        <ul className="space-y-2">
          {(data ?? []).map((p) => {
            const amounts = [...(balances.get(p.id)?.entries() ?? [])];
            return (
              <li key={p.id} className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] px-4 py-3 text-small">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">{p.status}</span>
                </div>
                <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                  {p.role_label} · {p.email} · {p.linked_user_id ? "Linked Nexo account" : "External / awaiting account link"}
                </p>
                {amounts.length > 0 ? (
                  <p className="mt-1 text-caption">
                    Allocated: {amounts.map(([currency, amount]) => formatMinorUnits(amount, currency)).join(" · ")}
                  </p>
                ) : null}
                {p.admin_note ? <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">Admin: {p.admin_note}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

async function AssignmentsView({ userId }: { userId: string }) {
  const supabase = await createClient();
  const [{ data: tracks }, { data: rules }, { data: assigns }] = await Promise.all([
    supabase
      .from("release_tracks")
      .select("id, title, releases!inner(owner_user_id)")
      .eq("releases.owner_user_id", userId)
      .limit(200),
    supabase
      .from("royalty_split_rules")
      .select("id, name")
      .eq("owner_user_id", userId)
      .eq("review_status", "approved")
      .eq("is_active", true),
    supabase
      .from("split_track_assignments")
      .select("id, track_id, split_rule_id, status, admin_note, created_at")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  const trackNames = new Map((tracks ?? []).map((track) => [track.id, track.title || "Untitled track"]));
  const ruleNames = new Map((rules ?? []).map((rule) => [rule.id, rule.name]));

  return (
    <div className="space-y-6">
      <SplitShareRealtime ownerUserId={userId} />
      <PageIntro
        title="Track Assignments"
        description="Attach an approved split rule to a track you own. New assignments go to admin review before they can affect royalty posting."
      />
      <AssignmentForm
        tracks={(tracks ?? []).map((t) => ({ id: t.id, title: t.title }))}
        rules={(rules ?? []).map((r) => ({ id: r.id, name: r.name }))}
      />
      {(assigns ?? []).length === 0 ? (
        <EmptyState title="No assignments" />
      ) : (
        <ul className="space-y-2 text-small">
          {(assigns ?? []).map((a) => (
            <li key={a.id} className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{trackNames.get(a.track_id) ?? a.track_id} → {ruleNames.get(a.split_rule_id) ?? a.split_rule_id}</span>
                <span className="text-caption uppercase text-[var(--nexo-text-muted)]">{a.status}</span>
              </div>
              {a.admin_note ? <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">Admin: {a.admin_note}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function RecoupmentsView({ userId }: { userId: string }) {
  const supabase = await createClient();
  const [{ data }, { data: payees }, { data: tracks }] = await Promise.all([
    supabase
      .from("portal_recoupments")
      .select("id, title, amount_minor, recovered_minor, currency, status, notes, payee_id, track_id, admin_note")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("portal_payees")
      .select("id, name, email")
      .eq("owner_user_id", userId)
      .eq("status", "approved")
      .order("name"),
    supabase
      .from("release_tracks")
      .select("id, title, releases!inner(owner_user_id)")
      .eq("releases.owner_user_id", userId)
      .limit(200),
  ]);

  const payeeNames = new Map((payees ?? []).map((payee) => [payee.id, payee.name]));
  const trackNames = new Map((tracks ?? []).map((track) => [track.id, track.title || "Untitled track"]));

  return (
    <div className="space-y-6">
      <SplitShareRealtime ownerUserId={userId} />
      <PageIntro
        title="Recoupments"
        description="Submit real recoupable advances or costs. Once approved, recovery is applied automatically against that payee’s future SplitShare allocations."
      />
      <RecoupmentForm
        payees={(payees ?? []).map((payee) => ({ id: payee.id, name: payee.name, email: payee.email }))}
        tracks={(tracks ?? []).map((track) => ({ id: track.id, title: track.title }))}
      />
      {(data ?? []).length === 0 ? (
        <EmptyState title="No recoupments" />
      ) : (
        <ul className="space-y-2">
          {(data ?? []).map((r) => (
            <li key={r.id} className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] px-4 py-3 text-small">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{r.title}</span>
                <span className="text-caption uppercase text-[var(--nexo-text-muted)]">{r.status}</span>
              </div>
              <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                {payeeNames.get(r.payee_id) ?? "Payee"} · {r.track_id ? trackNames.get(r.track_id) ?? "Track" : "All assigned tracks"}
              </p>
              <p className="mt-1 text-caption">
                Recovered {formatMinorUnits(Number(r.recovered_minor ?? 0), r.currency)} of {formatMinorUnits(r.amount_minor, r.currency)}
              </p>
              {r.admin_note ? <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">Admin: {r.admin_note}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function MembersView({ userId, isLabel }: { userId: string; isLabel: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("account_members")
    .select("id, email, display_name, role_label, status")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false });
  return (
    <div className="space-y-6">
      <PageIntro
        title="Account Members"
        description={
          isLabel
            ? "Invite teammates by email. This records an invite — it does not grant admin or a login until they accept off-platform."
            : "Artist accounts are single-user. Roster management lives on label accounts."
        }
      />
      {isLabel ? <MemberInviteForm /> : null}
      {(data ?? []).length === 0 ? (
        <EmptyState title={isLabel ? "No members invited" : "No additional members"} />
      ) : (
        <ul className="space-y-2 text-small">
          {(data ?? []).map((m) => (
            <li key={m.id} className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] px-4 py-3">
              {m.display_name || m.email} · {m.role_label} · {m.status}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function EnrollmentsView({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("account_enrollments")
    .select("service_key, status")
    .eq("owner_user_id", userId);
  const byKey = new Map((data ?? []).map((r) => [r.service_key, r.status]));
  return (
    <div className="space-y-6">
      <PageIntro
        title="Enrollments"
        description="Optional Nexo services. Unenrolled until you request and staff confirms. No third-party CONNECTED badges."
      />
      <ul className="divide-y divide-[var(--nexo-divider)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
        {ENROLLABLE_SERVICES.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-3 px-4 py-3">
            <span>
              <span className="block text-small font-medium">{s.label}</span>
              <span className="text-caption text-[var(--nexo-text-muted)]">
                {byKey.get(s.key) ?? "available"}
              </span>
            </span>
            <EnrollmentButton serviceKey={s.key} enrolled={Boolean(byKey.get(s.key))} />
          </li>
        ))}
      </ul>
    </div>
  );
}

async function LabelsView({ userId, isLabel }: { userId: string; isLabel: boolean }) {
  if (isLabel) {
    const label = await getLabelProfileForUser(userId);
    const roster = label?.id ? await listRosterArtists(label.id) : [];
    return (
      <div className="space-y-6">
        <PageIntro
          title={label?.label_name || "Label"}
          description="This label account and roster. Creating an artist does not create a login."
          actions={
            <Link
              href="/app/artists/new"
              className="inline-flex h-10 items-center rounded-[var(--nexo-radius)] bg-[var(--nexo-primary)] px-4 text-small font-medium [color:var(--nexo-primary-fg)]"
            >
              Create Artist
            </Link>
          }
        />
        <p className="text-small">
          Roster size: {roster.length}.{" "}
          <Link href="/app/artists" className="underline-offset-4 hover:underline">
            Open roster
          </Link>
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <PageIntro title="Labels" description="Artist accounts do not manage a label roster. Linked label names appear here only when staff attach them." />
      <EmptyState title="No label account linked" description="You are signed in as an artist." />
    </div>
  );
}

async function PaymentTaxView({ userId }: { userId: string }) {
  const supabase = await createClient();
  const payment = getPaymentConnectionState();
  const { data: tax } = await supabase
    .from("account_tax_details")
    .select("legal_name, country, tax_id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  return (
    <div className="space-y-6">
      <PageIntro
        title="Payment & Tax Details"
        description="Tax profile is stored on your account. Payment rails stay NOT CONNECTED until a live adapter is registered."
        actions={
          <Link href="/billing" className="text-small underline-offset-4 hover:underline">
            Plan & billing
          </Link>
        }
      />
      <Alert variant="warning" title="Payment">
        {payment.message}
      </Alert>
      <TaxDetailsForm initial={tax ?? null} />
    </div>
  );
}

async function ArtistSelfView({ userId }: { userId: string }) {
  const artist = await getArtistProfileForUser(userId);
  const dspLinks = artist ? await listArtistDspLinks(artist.id) : [];
  const supabase = await createClient();
  const { data: releases } = await supabase
    .from("releases")
    .select("id, title, status")
    .eq("owner_user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (!artist) {
    return (
      <div className="space-y-4">
        <PageIntro title="Artists" description="No artist profile row yet." />
        <EmptyState title="Artist profile missing" description="Complete My profile or contact support." />
      </div>
    );
  }
  return (
    <div className="space-y-8">
      <PageIntro
        title={artist.artist_name || artist.stage_name || "Artist"}
        description="Your catalog and DSP profile links. This is not label roster management."
        actions={
          <Link href="/dashboard/profile" className="text-small underline-offset-4 hover:underline">
            My profile
          </Link>
        }
      />
      <ArtistBioForm artistProfileId={artist.id} initialBio={artist.bio} />
      <DspProfileLinksEditor artistProfileId={artist.id} initial={dspLinks} />
      <section className="space-y-2">
        <h3 className="text-h4">Releases</h3>
        {(releases ?? []).length === 0 ? (
          <EmptyState
            title="No releases"
            action={
              <Link href="/dashboard/releases/new" className="underline">
                Create Release
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2 text-small">
            {(releases ?? []).map((r) => (
              <li key={r.id}>
                <Link href={`/dashboard/releases/${r.id}`} className="underline-offset-4 hover:underline">
                  {r.title || "Untitled"} · {r.status}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
