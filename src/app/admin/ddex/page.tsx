import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageIntro } from "@/components/workspace/PageIntro";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { listAdminReleases } from "@/lib/admin/queries";
import { ddexConfigPublicStatus } from "@/lib/ddex/config";
import { listDdexMessages } from "@/lib/ddex/persistence";
import { ddexUiStatus } from "@/lib/ddex/ui-status";
import { DdexStatusBadge } from "@/components/ddex/DdexStatusBadge";
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

  const latestByRelease = new Map<string, (typeof history)[number]>();
  for (const m of history) {
    if (!latestByRelease.has(m.release_id)) latestByRelease.set(m.release_id, m);
  }

  return (
    <div className="space-y-6">
      <PageIntro
        title="DDEX"
        description="ERN 4.3.2 NewReleaseMessage. Sender DPID stays on the server. Delivery is never marked complete without a real transport."
      />
      <Alert title="Recipient / transport">
        Sender configured: {cfg.senderConfigured ? "yes" : "no"} · Recipient configured:{" "}
        {cfg.recipientConfigured ? "yes" : "no"}
        {cfg.recipientName ? ` (${cfg.recipientName})` : ""} · Key: {cfg.recipientConfigKey} ·{" "}
        {cfg.testRecipient ? "test recipient" : "configured recipient"} · MessageControlType:{" "}
        {cfg.messageControlType}. Transport is not connected — messages are never marked delivered.
      </Alert>

      <section className="space-y-3">
        <h2 className="text-h4">Releases</h2>
        {items.length === 0 ? (
          <EmptyState title="No releases" description="Catalog releases will appear here for ERN generation." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Release</TH>
                <TH>Artist</TH>
                <TH>Catalog</TH>
                <TH>DDEX</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((r: { id: string; title: string; primary_artist_name: string; status: ReleaseStatus }) => {
                const latest = latestByRelease.get(r.id) ?? null;
                const ui = ddexUiStatus({ latest });
                return (
                  <TR key={r.id}>
                    <TD>
                      <Link className="font-medium underline-offset-4 hover:underline" href={`/admin/ddex/${r.id}`}>
                        {r.title || "Untitled"}
                      </Link>
                    </TD>
                    <TD>{r.primary_artist_name || "—"}</TD>
                    <TD>
                      <ReleaseStatusBadge status={r.status} />
                    </TD>
                    <TD>
                      <DdexStatusBadge status={ui} />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-h4">Message history</h2>
        {history.length === 0 ? (
          <EmptyState title="No ERN messages" description="Generated NewReleaseMessage rows appear here. XML is stored privately." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>File</TH>
                <TH>Validation</TH>
                <TH>Delivery</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {history.map((m) => (
                <TR key={m.id}>
                  <TD>
                    <Link className="font-medium underline-offset-4 hover:underline" href={`/admin/ddex/${m.release_id}`}>
                      {m.filename || m.message_id}
                    </Link>
                    <p className="text-caption text-[var(--nexo-text-muted)]">
                      {m.ern_version}
                      {m.xml_sha256 ? ` · sha256 ${m.xml_sha256.slice(0, 12)}…` : ""}
                    </p>
                  </TD>
                  <TD className="capitalize">{m.validation_status}</TD>
                  <TD className="capitalize">{m.delivery_status}</TD>
                  <TD>
                    <DdexStatusBadge
                      status={ddexUiStatus({
                        latest: m,
                      })}
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>
    </div>
  );
}
