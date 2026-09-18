import Link from "next/link";
import { notFound } from "next/navigation";
import { RequireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageIntro } from "@/components/workspace/PageIntro";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { ServiceRequestForm } from "@/components/portal/ServiceRequestForm";
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
import { ArtistBioForm } from "@/components/roster/ArtistBioForm";
import { findPortalItem, type PortalNavItem } from "@/lib/portal/ia";
import { knowledgeArticle, allKnowledgeArticles } from "@/lib/portal/knowledge";
import { loadAnalyticsSnapshot } from "@/lib/portal/analytics";
import { ENROLLABLE_SERVICES, SERVICE_KIND_LABEL, isAnalyticsKey } from "@/lib/portal/service-kinds";
import { formatMinorUnits } from "@/lib/finance/money";
import { getPaymentConnectionState } from "@/lib/finance/payment";
import { getArtistProfileForUser, getLabelProfileForUser, listArtistDspLinks, listRosterArtists } from "@/lib/roster/queries";
import { listPublishedVideos } from "@/lib/website/queries";
import { workspaceKindForRoles } from "@/lib/auth/nav";

async function loadReleases(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("releases")
    .select("id, title")
    .eq("owner_user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(40);
  return data ?? [];
}

export async function PortalFeaturePage({ href }: { href: string }) {
  const def = findPortalItem(href);
  if (!def) notFound();
  const ctx = await RequireRole(["artist", "label"]);
  const kind = workspaceKindForRoles(ctx.roles);
  if (kind === "admin") notFound();
  if (def.visibility && def.visibility !== "all" && def.visibility !== kind) notFound();

  if (def.pageKind === "knowledge") {
    return <KnowledgeView def={def} />;
  }
  if (def.pageKind === "analytics") {
    if (!def.analyticsKey || !isAnalyticsKey(def.analyticsKey)) notFound();
    const snap = await loadAnalyticsSnapshot(ctx.userId, def.analyticsKey);
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="Analytics" title={def.label} description={def.description} />
        <Alert variant={snap.statusLabel === "LIVE" ? "success" : "info"} title={snap.statusLabel}>
          {snap.note}
        </Alert>
        {snap.rowCount === 0 ? (
          <EmptyState
            title="No verified rows yet"
            description="Nexo does not invent stream counts or DSP credentials."
          />
        ) : (
          <dl className="grid gap-3 sm:grid-cols-3">
            <Stat label="Posted rows" value={String(snap.rowCount)} />
            <Stat
              label="Ledger total"
              value={snap.currency ? formatMinorUnits(snap.amountMinor, snap.currency) : String(snap.amountMinor)}
            />
            <Stat label="DSP codes" value={snap.dspCodes.join(", ") || "—"} />
          </dl>
        )}
      </div>
    );
  }
  if (def.pageKind === "service") {
    const supabase = await createClient();
    const releases = await loadReleases(ctx.userId);
    const { data: rows } = await supabase
      .from("portal_service_requests")
      .select("id, title, body, related_url, status, created_at, admin_note")
      .eq("owner_user_id", ctx.userId)
      .eq("kind", def.serviceKind)
      .order("created_at", { ascending: false })
      .limit(50);
    return (
      <div className="space-y-6">
        <PageIntro eyebrow="Request" title={def.label} description={def.description} />
        <ServiceRequestForm
          kind={def.serviceKind!}
          titlePlaceholder={SERVICE_KIND_LABEL[def.serviceKind as keyof typeof SERVICE_KIND_LABEL] ?? def.label}
          releases={releases}
        />
        {(rows ?? []).length === 0 ? (
          <EmptyState title="No requests yet" description="Submit a request. Staff review before anything is marked enrolled." />
        ) : (
          <ul className="space-y-3">
            {(rows ?? []).map((r) => (
              <li key={r.id} className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4">
                <p className="font-medium">{r.title}</p>
                <p className="text-caption text-[var(--nexo-text-muted)]">{r.status}</p>
                {r.body ? <p className="mt-2 text-small">{r.body}</p> : null}
                {r.related_url ? (
                  <p className="mt-1 break-all text-caption text-[var(--nexo-text-muted)]">{r.related_url}</p>
                ) : null}
                {r.admin_note ? <p className="mt-2 text-small text-[var(--nexo-text-muted)]">Staff: {r.admin_note}</p> : null}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4">
      <p className="text-caption text-[var(--nexo-text-muted)]">{label}</p>
      <p className="mt-1 text-h4 tabular-nums">{value}</p>
    </div>
  );
}

function KnowledgeView({ def }: { def: PortalNavItem }) {
  const article = def.knowledgeSlug ? knowledgeArticle(def.knowledgeSlug) : undefined;
  if (!article) {
    return (
      <div className="space-y-4">
        <PageIntro title={def.label} description={def.description} />
        <EmptyState title="Article unavailable" />
      </div>
    );
  }
  const others = allKnowledgeArticles().filter((a) => a.slug !== article.slug).slice(0, 6);
  return (
    <article className="space-y-6">
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
      .select("id, title, video_url, status, created_at, admin_note")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    listPublishedVideos({ limit: 12 }).catch(() => []),
  ]);
  return (
    <div className="space-y-6">
      <PageIntro
        title="Upload Music Video"
        description="Submit a public video URL for distribution review. Nexo does not host the file unless staff later ingest it."
      />
      <MusicVideoForm releases={releases} />
      {(rows ?? []).length === 0 ? (
        <EmptyState title="No video submissions" description="Paste a YouTube or Vimeo URL you control." />
      ) : (
        <ul className="space-y-3">
          {(rows ?? []).map((r) => (
            <li key={r.id} className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
              <p className="font-medium">{r.title}</p>
              <p className="text-caption text-[var(--nexo-text-muted)]">{r.status}</p>
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
    .select("id, title, isrc, track_no, releases!inner(id, title, owner_user_id)")
    .eq("releases.owner_user_id", userId)
    .order("track_no", { ascending: true })
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
  const { data } = await supabase
    .from("portal_payees")
    .select("id, name, email, role_label, created_at")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false });
  return (
    <div className="space-y-6">
      <PageIntro title="Payees" description="People or companies who can appear on SplitShare rules. This does not create logins." />
      <PayeeForm />
      {(data ?? []).length === 0 ? (
        <EmptyState title="No payees" />
      ) : (
        <ul className="space-y-2">
          {(data ?? []).map((p) => (
            <li key={p.id} className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] px-4 py-3 text-small">
              <span className="font-medium">{p.name}</span>
              <span className="text-[var(--nexo-text-muted)]">
                {" "}
                · {p.role_label}
                {p.email ? ` · ${p.email}` : ""}
              </span>
            </li>
          ))}
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
      .limit(100),
    supabase.from("royalty_split_rules").select("id, name").eq("owner_user_id", userId).eq("is_active", true),
    supabase
      .from("split_track_assignments")
      .select("id, track_id, split_rule_id, created_at")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false }),
  ]);
  return (
    <div className="space-y-6">
      <PageIntro title="Track Assignments" description="Attach an active split rule to a track you own." />
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
              Track {a.track_id.slice(0, 8)}… → rule {a.split_rule_id.slice(0, 8)}…
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function RecoupmentsView({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("portal_recoupments")
    .select("id, title, amount_minor, currency, status, notes")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false });
  return (
    <div className="space-y-6">
      <PageIntro title="Recoupments" description="Record recoupable amounts you actually agreed. Nothing is estimated." />
      <RecoupmentForm />
      {(data ?? []).length === 0 ? (
        <EmptyState title="No recoupments" />
      ) : (
        <ul className="space-y-2">
          {(data ?? []).map((r) => (
            <li key={r.id} className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] px-4 py-3 text-small">
              <span className="font-medium">{r.title}</span> · {formatMinorUnits(r.amount_minor, r.currency)} · {r.status}
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
