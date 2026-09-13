import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { DistributionNav } from "@/components/distribution/DistributionNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { listArtistDspMappings } from "@/lib/migration/queries";
import { MappingClient } from "@/components/distribution/MappingClient";

export const metadata: Metadata = {
  title: "Artist DSP mapping",
  robots: { index: false, follow: false },
};

export default async function MappingPage() {
  await RequireAdmin();
  const rows = await listArtistDspMappings();

  return (
    <div>
      <PageHeader
        title="Artist mapping"
        description="Manual DSP artist ID mappings. source_connected stays false without real API credentials."
      />
      <DistributionNav current="/admin/distribution/mapping" />
      <div className="mt-4">
        <MappingClient />
      </div>
      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No mappings" description="Add DSP artist mappings for migration discovery." />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {rows.map((m) => {
            const ap = m.artist_profiles as { display_name?: string } | null;
            return (
              <li key={m.id} className="px-4 py-3 text-small">
                <p className="font-medium">
                  {ap?.display_name || m.artist_profile_id} · {m.dsp_name}
                </p>
                <p className="text-caption text-[var(--nexo-text-muted)]">
                  external id: {m.external_artist_id || "—"}
                  {" · connected="}
                  {String(m.source_connected)}
                  {" · verified="}
                  {String(m.verified)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
