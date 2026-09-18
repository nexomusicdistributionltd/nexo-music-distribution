import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageIntro } from "@/components/workspace/PageIntro";
import { CompactStat, AttentionList } from "@/components/workspace/CompactStat";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { getAdminAttention } from "@/lib/admin/attention";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { getProviderConnectionState } from "@/lib/provider";
import { ddexConfigPublicStatus } from "@/lib/ddex/config";
import { createServiceClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Admin operations",
  robots: { index: false, follow: false },
};

type CountResult = { count: number | null; error: unknown };

async function liveCount(
  table: string,
  apply?: (query: any) => any
): Promise<number> {
  const db = createServiceClient();
  let query = db.from(table).select("*", { count: "exact", head: true });
  if (apply) query = apply(query);
  const result = (await query) as CountResult;
  return result.error ? 0 : Number(result.count ?? 0);
}

export default async function AdminDashboardPage() {
  await RequireAdmin();

  const [attention, provider, counts] = await Promise.all([
    getAdminAttention(),
    getProviderConnectionState(),
    Promise.all([
      liveCount("profiles"),
      liveCount("artist_profiles"),
      liveCount("label_profiles"),
      liveCount("releases"),
      liveCount("identity_verifications", (q) => q.in("status", ["submitted", "pending_review", "additional_info_required"])),
      liveCount("distribution_agreement_executions"),
      liveCount("payout_requests", (q) => q.in("status", ["requested", "approved", "processing"])),
      liveCount("notification_broadcasts"),
      liveCount("website_partners", (q) => q.eq("is_active", true)),
      liveCount("blog_posts", (q) => q.eq("status", "published")),
    ]),
  ]);
  const ddex = ddexConfigPublicStatus();

  const [
    users,
    artists,
    labels,
    releases,
    verificationQueue,
    agreements,
    payoutQueue,
    broadcasts,
    publishedPartners,
    publishedPosts,
  ] = counts;

  const strips = [
    { label: "QC queue", value: attention.qcOpen, href: "/admin/qc", tone: attention.qcOpen ? "warning" as const : "default" as const },
    { label: "Changes requested", value: attention.changesRequested, href: "/admin/releases?status=changes_requested", tone: attention.changesRequested ? "warning" as const : "default" as const },
    { label: "Delivery failed", value: attention.deliveryFailed, href: "/admin/distribution/failed", tone: attention.deliveryFailed ? "urgent" as const : "default" as const },
    { label: "Upcoming", value: attention.upcoming, href: "/admin/releases?status=scheduled" },
    { label: "New artists (7d)", value: attention.newArtists7d, href: "/admin/artists" },
    { label: "New labels (7d)", value: attention.newLabels7d, href: "/admin/labels" },
    { label: "Inquiries", value: attention.newContact, href: "/admin/contact", tone: attention.newContact ? "warning" as const : "default" as const },
    { label: "Failed email", value: attention.failedEmail, href: "/admin/newsletter" },
    { label: "DDEX issues", value: attention.ddexFailed, href: "/admin/ddex", tone: attention.ddexFailed ? "urgent" as const : "default" as const },
    { label: "Open tickets", value: attention.openTickets, href: "/admin/support" },
  ];

  const snapshot = [
    { label: "Accounts", value: users, href: "/admin/users" },
    { label: "Artists", value: artists, href: "/admin/artists" },
    { label: "Labels", value: labels, href: "/admin/labels" },
    { label: "Catalog releases", value: releases, href: "/admin/releases" },
    { label: "Identity review", value: verificationQueue, href: "/admin/verifications" },
    { label: "Signed agreements", value: agreements, href: "/admin/agreements" },
    { label: "Payout operations", value: payoutQueue, href: "/admin/finance/payouts" },
    { label: "Broadcasts sent", value: broadcasts, href: "/admin/notifications" },
  ];

  const operations = [
    ["Catalog & QC", "Releases, metadata review, identifiers, QC decisions and delivery readiness.", "/admin/releases"],
    ["Distribution Engine", "Provider authorization, queue, submissions, delivery, webhooks, mappings and takedowns.", "/admin/distribution"],
    ["Identity & agreements", "Review KYC submissions and retain executed distribution agreements.", "/admin/verifications"],
    ["Royalties & payouts", "Royalty statements, ledger, payout requests, methods and manual operations.", "/admin/finance"],
    ["Website CMS", `${publishedPartners} published partner(s) · ${publishedPosts} published blog post(s). Manage homepage, artists, music, pages and videos.`, "/admin/website"],
    ["Notifications", "Publish account broadcasts and review delivery history.", "/admin/notifications"],
    ["Email operations", "Transactional templates, outbox and delivery failures.", "/admin/emails"],
    ["Support & audit", "Support tickets, contact inbox, security/audit history and operational settings.", "/admin/support"],
  ] as const;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Nexo Operations"
        title="Administration command center"
        description="Live operational data across accounts, catalog, verification, agreements, distribution, royalties, payouts and website publishing. No estimated KPIs."
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <ProviderBanner connected={provider.connected} />
        <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] px-4 py-3 text-caption text-[var(--nexo-text-muted)]">
          Distribution: <strong className="text-[var(--nexo-text)]">{provider.connected ? "CONNECTED" : "ACTION REQUIRED"}</strong>
          {" · "}Webhook: <strong className="text-[var(--nexo-text)]">{provider.webhookConfigured ? "CONFIGURED" : "MISSING"}</strong>
          {" · "}DDEX sender: <strong className="text-[var(--nexo-text)]">{ddex.senderConfigured ? "READY" : "NOT READY"}</strong>
        </div>
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-h4">Platform snapshot</h2>
            <p className="text-caption text-[var(--nexo-text-muted)]">Authoritative database counts.</p>
          </div>
          <Link href="/admin/audit" className="text-small underline-offset-4 hover:underline">Open audit log</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {snapshot.map((item) => (
            <Link key={item.label} href={item.href}>
              <Card className="h-full transition hover:border-[var(--nexo-accent)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-caption uppercase tracking-[0.1em] text-[var(--nexo-text-muted)]">{item.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-h2 tabular-nums">{item.value.toLocaleString("en-US")}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-h4">Operational queues</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {strips.map((s) => (
            <CompactStat key={s.label} {...s} />
          ))}
        </div>
        {attention.items.length > 0 ? (
          <div className="mt-4">
            <AttentionList items={attention.items} />
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState title="No urgent queue items" description="New QC, delivery, support and compliance work will appear here automatically." />
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-h4">Operations</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {operations.map(([title, description, href]) => (
            <Link key={href} href={href}>
              <Card className="h-full transition hover:border-[var(--nexo-accent)]">
                <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-small leading-6 text-[var(--nexo-text-secondary)]">{description}</p>
                  <p className="mt-4 text-caption font-semibold uppercase tracking-[0.08em]">Open →</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
