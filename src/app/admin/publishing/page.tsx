import type { Metadata } from "next";
import { RequireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { createClient } from "@/lib/supabase/server";
import { FinanceNav } from "@/components/finance/FinanceNav";
import {
  NO_FAKE_COLLECTION_MESSAGE,
  NO_FAKE_REGISTRATION_MESSAGE,
} from "@/lib/publishing/types";
import { CreatePublishingWorkForm } from "@/components/finance/CreatePublishingWorkForm";

export const metadata: Metadata = {
  title: "Publishing",
  robots: { index: false, follow: false },
};

export default async function AdminPublishingPage() {
  await RequireAdmin();
  const supabase = await createClient();
  const [{ data: works }, { data: claims }] = await Promise.all([
    supabase.from("publishing_works").select("*").order("updated_at", { ascending: false }).limit(50),
    supabase
      .from("publishing_collection_claims")
      .select("id, status, right_type, amount_minor, currency, source_provider")
      .limit(20),
  ]);

  return (
    <div>
      <PageHeader
        title="Nexo Publishing Group"
        description="Works, writers/publishers, shares, IPI/CAE, ISWC, PRO/CMO fields. Architecture for performance/mechanical/sync/print/international."
      />
      <FinanceNav />
      <Alert title="No fake collections">{NO_FAKE_COLLECTION_MESSAGE}</Alert>
      <Alert className="mt-2" title="Registration">
        {NO_FAKE_REGISTRATION_MESSAGE}
      </Alert>
      <div className="mt-4">
        <CreatePublishingWorkForm />
      </div>
      {(works ?? []).length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No publishing works"
            description="Create a work to manage shares and recording links. Registration remains draft until a connected source exists."
          />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          {(works ?? []).map((w) => (
            <li key={w.id} className="px-4 py-3 text-small">
              <p className="font-medium">{w.title}</p>
              <p className="text-caption text-[var(--nexo-text-muted)]">
                {w.registration_status} · ISWC {w.iswc || "—"} · owner {w.owner_user_id}
                {w.conflict_reason ? ` · conflict: ${w.conflict_reason}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
      {(claims ?? []).length > 0 ? (
        <div className="mt-6">
          <h2 className="mb-2 text-h3">Collection claims</h2>
          <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
            {(claims ?? []).map((c) => (
              <li key={c.id} className="px-4 py-3 text-small">
                {c.right_type} · {c.status}
                {c.source_provider ? ` · ${c.source_provider}` : " · NOT CONNECTED"}
                {c.amount_minor != null && c.currency
                  ? ` · ${c.amount_minor} ${c.currency}`
                  : " · NO DATA"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
