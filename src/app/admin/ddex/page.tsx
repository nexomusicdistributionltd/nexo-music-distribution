import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { listAdminReleases } from "@/lib/admin/queries";
import { ddexConfigPublicStatus } from "@/lib/ddex/config";
import { listDdexMessages } from "@/lib/ddex/persistence";
import { ReleaseStatusBadge } from "@/components/releases/ReleaseStatusBadge";
import type { ReleaseStatus } from "@/lib/releases/types";

export const metadata: Metadata = {
  title: "DDEX",
  robots: { index: false, follow: false },
};

export default async function AdminDdexPage() {
  await RequireAdminPermission("admin:ddex");
  const cfg = ddexConfigPublicStatus();
  const [{ items }, history] = await Promise.all([
    listAdminReleases({ pageSize: 30 }),
    listDdexMessages(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="DDEX"
        description="ERN 4.3.2 NewReleaseMessage (Audio profile). Sender DPID stays server-side. No invented DSP connections."
      />
      <Alert title="Recipient / transport">
        Sender configured: {cfg.senderConfigured ? "yes" : "no"} · Recipient configured:{" "}
        {cfg.recipientConfigured ? "yes" : "no"}
        {cfg.recipientName ? ` (${cfg.recipientName})` : ""} · Key: {cfg.recipientConfigKey} ·{" "}
        {cfg.testRecipient ? "test recipient" : "configured recipient"} · MessageControlType:{" "}
        {cfg.messageControlType}. Transport is not connected — messages are never marked delivered.
      </Alert>

      <section>
        <h2 className="mb-3 text-h4">Releases</h2>
        {items.length === 0 ? (
          <EmptyState title="No releases" description="Catalog releases will appear here for ERN generation." />
        ) : (
          <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
            {items.map((r: { id: string; title: string; primary_artist_name: string; status: ReleaseStatus }) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-small">
                <div>
                  <Link className="font-medium underline-offset-4 hover:underline" href={`/admin/ddex/${r.id}`}>
                    {r.title || "Untitled"}
                  </Link>
                  <p className="text-caption text-[var(--nexo-text-muted)]">{r.primary_artist_name}</p>
                </div>
                <ReleaseStatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-h4">Message history</h2>
        {history.length === 0 ? (
          <EmptyState title="No ERN messages" description="Generated NewReleaseMessage rows appear here. XML is stored privately." />
        ) : (
          <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] text-small">
            {history.map((m) => (
              <li key={m.id} className="px-4 py-3">
                <Link className="font-medium underline-offset-4 hover:underline" href={`/admin/ddex/${m.release_id}`}>
                  {m.filename || m.message_id}
                </Link>
                <p className="text-caption text-[var(--nexo-text-muted)]">
                  {m.ern_version} · validation {m.validation_status} · delivery {m.delivery_status}
                  {m.xml_sha256 ? ` · sha256 ${m.xml_sha256.slice(0, 12)}…` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
