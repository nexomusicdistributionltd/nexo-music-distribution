import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/admin/PageHeader";
import { DistributionNav } from "@/components/distribution/DistributionNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { listArtistDspMappings } from "@/lib/migration/queries";
import { MappingClient } from "@/components/distribution/MappingClient";
import { getProviderConnectionState } from "@/lib/provider";

export const metadata: Metadata = {
  title: "Artist DSP mapping",
  robots: { index: false, follow: false },
};

export default async function MappingPage() {
  await RequireAdmin();
  const db = await createClient();

  const [rows, { data: artistRows }, provider] = await Promise.all([
    listArtistDspMappings().catch(() => []),
    db
      .from("artist_profiles")
      .select("id,artist_name,stage_name")
      .order("artist_name", { ascending: true })
      .limit(500),
    getProviderConnectionState().catch(() => ({
      connected: false,
      providerName: null,
      message: "Distribution Engine health is unavailable.",
      webhookConfigured: false,
    })),
  ]);

  const artists = (artistRows ?? []).map((artist) => ({
    id: artist.id,
    name: artist.artist_name || artist.stage_name || artist.id,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Artist mapping"
        description="Map Nexo artists to external DSP artist identifiers used for delivery, migration and catalog reconciliation."
      />
      <DistributionNav current="/admin/distribution/mapping" />

      <div className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4 text-small">
        <span className="font-medium">Distribution Engine:</span>{" "}
        {provider.connected ? "API access verified." : provider.message}
      </div>

      <MappingClient artists={artists} />

      {rows.length === 0 ? (
        <EmptyState
          title="No mappings"
          description="Choose an artist above and add the DSP artist ID. Existing mappings will appear here."
        />
      ) : (
        <ul className="divide-y divide-[var(--nexo-border)] overflow-hidden rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {rows.map((mapping) => {
            const artist = mapping.artist_profiles as {
              artist_name?: string | null;
              stage_name?: string | null;
            } | null;
            return (
              <li key={mapping.id} className="px-4 py-3 text-small">
                <p className="font-medium">
                  {artist?.artist_name || artist?.stage_name || mapping.artist_profile_id} ·{" "}
                  {mapping.dsp_name}
                </p>
                <p className="text-caption text-[var(--nexo-text-muted)]">
                  External ID: {mapping.external_artist_id || "—"}
                  {" · "}
                  {mapping.verified ? "Staff verified" : "Pending verification"}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
