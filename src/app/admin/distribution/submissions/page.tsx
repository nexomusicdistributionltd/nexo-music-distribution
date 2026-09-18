import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { DistributionNav } from "@/components/distribution/DistributionNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { getProviderConnectionState } from "@/lib/provider";
import { listProviderSubmissions } from "@/lib/distribution/queries";

export const metadata: Metadata = {
  title: "Distribution submissions",
  robots: { index: false, follow: false },
};

export default async function SubmissionsPage() {
  await RequireAdmin();
  const provider = await getProviderConnectionState();
  const rows = await listProviderSubmissions(50);

  return (
    <div>
      <PageHeader title="Submissions" description="Distribution Engine submission history and delivery attempts." />
      <DistributionNav current="/admin/distribution/submissions" />
      <ProviderBanner connected={provider.connected} />
      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No submissions" description="Submit attempts appear after queue submit actions." />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {rows.map((s) => {
            const rel = s.releases as { title?: string } | null;
            return (
              <li key={s.id} className="px-4 py-3 text-small">
                <p className="font-medium">{rel?.title || s.release_id}</p>
                <p className="text-caption text-[var(--nexo-text-muted)]">
                  {s.status} · attempt {s.attempt_number} · Distribution Engine
                  {s.provider_release_id ? ` · delivery id ${s.provider_release_id}` : ""}
                </p>
                {s.error_message ? (
                  <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">{s.error_message}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
