import type { Metadata } from "next";
import Link from "next/link";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProviderBanner } from "@/components/releases/ProviderBanner";
import { ReleaseStatusBadge } from "@/components/releases/ReleaseStatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import { getProviderConnectionState } from "@/lib/provider";
import type { ReleaseStatus } from "@/lib/releases/types";

export const metadata: Metadata = {
  title: "Distribution monitor",
  robots: { index: false, follow: false },
};

const MONITOR_STATUSES: ReleaseStatus[] = [
  "approved",
  "scheduled",
  "delivering",
  "delivered",
  "live",
  "takedown_requested",
  "taken_down",
];

export default async function DistributionPage() {
  await RequireAdmin();
  const provider = getProviderConnectionState();
  const supabase = await createClient();
  const { data } = await supabase
    .from("releases")
    .select("id, title, primary_artist_name, status, provider_connected, updated_at")
    .in("status", MONITOR_STATUSES)
    .order("updated_at", { ascending: false })
    .limit(50);

  return (
    <div>
      <PageHeader
        title="Distribution monitor"
        description="Internal release statuses only. No fabricated DSP delivery rows."
      />
      <ProviderBanner connected={provider.connected} />
      {(data ?? []).length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Nothing in distribution pipeline"
            description="Approved and later statuses will list here. Delivery requires a connected provider."
          />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {(data ?? []).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div>
                <Link href={`/admin/releases/${r.id}`} className="font-medium underline-offset-4 hover:underline">
                  {r.title || "Untitled"}
                </Link>
                <p className="text-caption text-[var(--nexo-text-muted)]">
                  {r.primary_artist_name} · provider_connected={String(r.provider_connected)}
                </p>
              </div>
              <ReleaseStatusBadge status={r.status as ReleaseStatus} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
