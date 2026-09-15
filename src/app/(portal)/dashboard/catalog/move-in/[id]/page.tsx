import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { MoveInClient } from "@/components/migration/MoveInClient";

export const metadata: Metadata = {
  title: "Move In details",
  robots: { index: false, follow: false },
};

export default async function MoveInDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await RequireAuth({ redirectTo: "/login" });
  const supabase = await createClient();
  const { data: migration } = await supabase
    .from("catalog_migrations")
    .select("*")
    .eq("id", id)
    .eq("owner_user_id", ctx.userId)
    .maybeSingle();
  if (!migration) notFound();

  const { data: items } = await supabase
    .from("catalog_migration_items")
    .select(
      "id, external_title, external_artist_name, external_upc, external_isrcs, status, selected, metadata_gaps, conflict_reason, draft_release_id"
    )
    .eq("migration_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-h2">{migration.title || "Move In Catalog"}</h1>
      <MoveInClient
        initialMigration={migration}
        initialItems={(items ?? []) as Parameters<typeof MoveInClient>[0]["initialItems"]}
      />
    </div>
  );
}
