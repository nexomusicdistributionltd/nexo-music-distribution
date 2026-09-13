import type { Metadata } from "next";
import { RequireRole } from "@/lib/auth/guards";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/server";
import {
  NO_FAKE_COLLECTION_MESSAGE,
  NO_FAKE_REGISTRATION_MESSAGE,
} from "@/lib/publishing/types";
import { EarningsNav } from "@/components/finance/EarningsNav";

export const metadata: Metadata = {
  title: "Publishing",
  robots: { index: false, follow: false },
};

export default async function AppPublishingPage() {
  const user = await RequireRole(["artist", "label", "admin", "super_admin"]);
  const supabase = await createClient();
  const { data: works } = await supabase
    .from("publishing_works")
    .select("*")
    .eq("owner_user_id", user.userId)
    .order("updated_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-4">
      <h1 className="text-h2">Publishing</h1>
      <EarningsNav />
      <Alert>
        The public marketing page remains at <strong>/publishing</strong>. This workspace is for
        Nexo Publishing Group tools.
      </Alert>
      <Alert title="Collections">{NO_FAKE_COLLECTION_MESSAGE}</Alert>
      <Alert title="Registration">{NO_FAKE_REGISTRATION_MESSAGE}</Alert>
      {(works ?? []).length === 0 ? (
        <EmptyState
          title="No publishing works"
          description="Works you own will list here. PRO registration and collected royalties are not claimed without connected sources."
        />
      ) : (
        <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {(works ?? []).map((w) => (
            <li key={w.id} className="px-4 py-3 text-small">
              <p className="font-medium">{w.title}</p>
              <p className="text-caption text-[var(--nexo-text-muted)]">
                {w.registration_status} · ISWC {w.iswc || "—"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
