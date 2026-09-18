import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageIntro } from "@/components/workspace/PageIntro";
import { CompactStat, AttentionList } from "@/components/workspace/CompactStat";
import { EmptyState } from "@/components/ui/EmptyState";
import { getAdminAttention } from "@/lib/admin/attention";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { getProviderConnectionState } from "@/lib/provider";
import { ddexConfigPublicStatus } from "@/lib/ddex/config";


const ADMIN_CONTROL_AREAS = [
  {
    title: "Catalog & QC",
    description: "Releases, metadata, artwork, contributors, identifiers and quality-control decisions.",
    href: "/admin/releases",
  },
  {
    title: "Distribution Engine",
    description: "Provider authorization, submissions, delivery jobs, mappings, webhooks and retries.",
    href: "/admin/distribution",
  },
  {
    title: "Artists, labels & verification",
    description: "Accounts, identity verification, roster records and mandatory distribution agreements.",
    href: "/admin/verifications",
  },
  {
    title: "Royalties & payouts",
    description: "Ledger-backed royalties, statements, payout methods, requests and finance operations.",
    href: "/admin/finance",
  },
  {
    title: "Analytics",
    description: "Provider and ledger-backed performance data without generated stream or revenue figures.",
    href: "/admin/analytics",
  },
  {
    title: "Communications",
    description: "Inbox, branded automated email, broadcast notifications, newsletters and delivery activity.",
    href: "/admin/emails",
  },
  {
    title: "Website CMS",
    description: "Homepage settings, featured catalog, partners, blog, footer pages and Nexo video surfaces.",
    href: "/admin/website",
  },
  {
    title: "Compliance & audit",
    description: "Operational audit trail, compliance controls, reports and administrative search.",
    href: "/admin/audit",
  },
] as const;

export const metadata: Metadata = {
  title: "Admin operations",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  await RequireAdmin();
  const attention = await getAdminAttention();
  const provider = await getProviderConnectionState();
  const ddex = ddexConfigPublicStatus();

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
  ].filter((s) => s.value > 0);

  const hasWork = strips.length > 0 || attention.items.length > 0;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Operations"
        title="What needs attention"
        description="Live queues from the catalog, QC, DDEX, and inbox. Empty when there is nothing to do — no estimated KPIs."
      />
      <ProviderBanner connected={provider.connected} />
      <p className="text-caption text-[var(--nexo-text-muted)]">
        DDEX sender {ddex.senderConfigured ? "configured" : "not configured"} · recipient{" "}
        {ddex.recipientConfigured ? "configured" : "not configured"}
        {ddex.recipientName ? ` (${ddex.recipientName})` : ""}. DPID values stay server-side.
      </p>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[var(--nexo-text-muted)]">
              Control center
            </p>
            <h2 className="mt-1 text-h3">Nexo operations</h2>
          </div>
          <Link
            href="/admin/settings"
            className="text-small text-[var(--nexo-text-secondary)] underline-offset-4 hover:underline"
          >
            Administration settings
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {ADMIN_CONTROL_AREAS.map((area) => (
            <Link
              key={area.href}
              href={area.href}
              className="group flex min-h-40 flex-col justify-between rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 shadow-[var(--nexo-shadow-sm)] transition hover:-translate-y-0.5 hover:border-[var(--nexo-border-strong)]"
            >
              <div>
                <h3 className="text-h4">{area.title}</h3>
                <p className="mt-2 text-small leading-6 text-[var(--nexo-text-muted)]">
                  {area.description}
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1 text-caption font-medium">
                Open <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {!hasWork ? (
        <EmptyState
          title="Queue is clear"
          description="When artists submit releases, request changes, or inquiries arrive, they appear here."
        />
      ) : (
        <>
          {strips.length > 0 ? (
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {strips.map((s) => (
                <CompactStat key={s.label} {...s} />
              ))}
            </section>
          ) : null}
          {attention.items.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-h4">Now</h2>
              <AttentionList items={attention.items} />
            </section>
          ) : null}
        </>
      )}

      <section className="flex flex-wrap gap-3 text-small">
        <Link className="underline-offset-4 hover:underline" href="/admin/qc">
          QC
        </Link>
        <Link className="underline-offset-4 hover:underline" href="/admin/ddex">
          DDEX
        </Link>
        <Link className="underline-offset-4 hover:underline" href="/admin/releases">
          Catalog
        </Link>
        <Link className="underline-offset-4 hover:underline" href="/admin/contact">
          Inquiries
        </Link>
      </section>
    </div>
  );
}
