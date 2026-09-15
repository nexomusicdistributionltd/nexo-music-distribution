import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { DdexReadinessPanel } from "@/components/ddex/DdexReadinessPanel";
import { DdexAdminOps } from "@/components/ddex/DdexAdminOps";
import { ddexConfigPublicStatus } from "@/lib/ddex/config";
import { listDdexMessages, loadDdexSnapshot } from "@/lib/ddex/persistence";
import { readinessFromSnapshot } from "@/lib/ddex/admin-ops";
import { Alert } from "@/components/ui/Alert";

export const metadata: Metadata = {
  title: "DDEX release",
  robots: { index: false, follow: false },
};

export default async function AdminDdexReleasePage({
  params,
}: {
  params: Promise<{ releaseId: string }>;
}) {
  await RequireAdminPermission("admin:ddex");
  const { releaseId } = await params;
  const snapshot = await loadDdexSnapshot(releaseId);
  if (!snapshot) notFound();
  const cfg = ddexConfigPublicStatus();
  const readiness = readinessFromSnapshot(snapshot);
  const history = await listDdexMessages(releaseId);
  const latest = history[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`DDEX · ${snapshot.release.title}`}
        description={`${snapshot.release.primary_artist_name} · ${snapshot.release.release_type} · ERN 4.3.2 Audio`}
      />
      <p className="text-small">
        <Link className="underline-offset-4 hover:underline" href="/admin/ddex">
          All DDEX
        </Link>
        {" · "}
        <Link className="underline-offset-4 hover:underline" href={`/admin/releases/${releaseId}`}>
          Release review
        </Link>
      </p>
      <Alert>
        Sender DPID {cfg.senderConfigured ? "configured" : "missing"} · Recipient{" "}
        {cfg.recipientConfigured ? "configured" : "missing"}
        {cfg.recipientName ? ` (${cfg.recipientName})` : ""}. DPIDs are not shown in the UI.
      </Alert>
      <DdexReadinessPanel report={readiness} />
      <DdexAdminOps releaseId={releaseId} latestMessageId={latest?.message_id} />
      <section className="space-y-2">
        <h2 className="text-h4">History</h2>
        {history.length === 0 ? (
          <p className="text-small text-[var(--nexo-text-muted)]">No messages generated yet.</p>
        ) : (
          <ul className="space-y-2 text-small">
            {history.map((m) => (
              <li key={m.id} className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3">
                <p className="font-medium">{m.filename || m.message_id}</p>
                <p className="text-caption text-[var(--nexo-text-muted)]">
                  validation {m.validation_status} · delivery {m.delivery_status} · {m.ern_version}
                  {m.xml_sha256 ? ` · sha256 ${m.xml_sha256}` : ""}
                </p>
                {m.validation_status === "valid" ? (
                  <a className="mt-1 inline-block underline-offset-4 hover:underline" href={`/admin/ddex/download/${encodeURIComponent(m.message_id)}`}>
                    Download XML
                  </a>
                ) : null}
                {m.error ? <p className="mt-1 text-[var(--nexo-text-muted)]">{m.error}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
