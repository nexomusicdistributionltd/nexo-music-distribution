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
import { listPublicDspTargets } from "@/lib/ddex/admin-ops";
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
  let targets: Awaited<ReturnType<typeof listPublicDspTargets>> = [];
  try {
    targets = await listPublicDspTargets();
  } catch {
    targets = [];
  }

  const latestByRelease = new Map<string, (typeof history)[number]>();
  for (const m of history) {
    if (!latestByRelease.has(m.release_id)) latestByRelease.set(m.release_id, m);
  }

  return (
    <div className="space-y-6">
      <PageIntro
        title="DDEX"
        description="ERN 4.3.2 generation and Stardust-backed test delivery. Sender DPID stays on the server. Commercial DSP delivery is NOT CONNECTED."
      />
      <Alert title="Recipient / transport">
        Sender configured: {cfg.senderConfigured ? "yes" : "no"}
        {cfg.lockedProductionSender ? " · locked production identity" : " · delivery blocked until locked DPID is set"}.
        Recipient configured: {cfg.recipientConfigured ? "yes" : "no (local test target uses Nexo loopback)"}.
        MessageControlType: {cfg.messageControlType}. Stardust does not create commercial DSP relationships.
        Contact env: {cfg.contactConfigured ? "set" : "not set / not invented"}.
      </Alert>

      <section className="space-y-3">
        <h2 className="text-h4">Delivery targets</h2>
        {targets.length === 0 ? (
          <EmptyState
            title="No targets loaded"
            description="Apply the Stardust DDEX migration to create the isolated Nexo Local Test Target. No commercial DSPs are seeded."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Target</TH>
                <TH>Protocol</TH>
                <TH>ERN</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {targets.map((t) => (
                <TR key={t.id}>
                  <TD>
                    {t.displayName}
                    {t.isTest ? " · test" : ""}
                  </TD>
                  <TD className="uppercase">{t.protocol}</TD>
                  <TD>{t.ernVersion}</TD>
                  <TD>
                    {t.planningOnly
                      ? "NOT CONNECTED (planning)"
                      : t.connected
                        ? t.isTest
                          ? "Test connected"
                          : "Connected"
                        : "NOT CONNECTED"}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>

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
