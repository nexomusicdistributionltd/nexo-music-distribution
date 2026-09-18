import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageIntro } from "@/components/workspace/PageIntro";
import { CompactStat, AttentionList } from "@/components/workspace/CompactStat";
import { EmptyState } from "@/components/ui/EmptyState";
import { getAdminAttention } from "@/lib/admin/attention";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { getProviderConnectionState } from "@/lib/provider";
import { ddexConfigPublicStatus } from "@/lib/ddex/config";

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

      <section className="space-y-4">
        <div>
          <h2 className="text-h4">Operations workspace</h2>
          <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
            Direct control of accounts, verification, catalog, distribution, money, communications and the public website.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[
            ["Artists", "/admin/artists", "Profiles, catalog ownership and website presence"],
            ["Labels", "/admin/labels", "Label accounts, roster and catalog"],
            ["Identity verification", "/admin/verifications", "Review KYC submissions and request information"],
            ["Signed agreements", "/admin/agreements", "Executed distribution contracts and downloads"],
            ["Catalog & releases", "/admin/releases", "Metadata, QC corrections and release state"],
            ["Distribution engine", "/admin/distribution", "Queue, provider, webhooks, mappings and delivery"],
            ["Royalties", "/admin/royalties", "Imports, ledger and royalty operations"],
            ["Payouts", "/admin/payouts", "Payout requests and payment processing"],
            ["Payout methods", "/admin/finance/payout-methods", "Approved and manual payout-method controls"],
            ["Website", "/admin/website", "Homepage, featured artists and releases"],
            ["Notifications", "/admin/notifications", "Realtime user broadcasts"],
            ["Support", "/admin/support", "Tickets and account assistance"],
            ["Email operations", "/admin/emails", "Templates, inbox, sends and delivery activity"],
            ["Reports", "/admin/reports", "Operational report exports"],
            ["Publishing", "/admin/publishing", "Nexo Publishing Group records"],
            ["Settings", "/admin/settings", "Platform administration and configuration"],
          ].map(([label, href, description]) => (
            <Link
              key={href}
              href={href}
              className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--nexo-border-strong)]"
            >
              <p className="font-medium">{label}</p>
              <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">{description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
