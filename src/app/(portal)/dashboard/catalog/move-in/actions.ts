"use server";

import { revalidatePath } from "next/cache";
import { RequireAuth, assertCanMutateCatalog } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { discoverExternalCatalog } from "@/lib/migration/external-catalog";
import type { ArtistProvidedCatalogItem, MoveInImportMethod } from "@/lib/migration/move-in";
import { hasCatalogMigrationAccess } from "@/lib/billing/feature-access";
import { safeGetEntitlementsForAuth } from "@/lib/billing/queries";
import type { AuthUserContext } from "@/lib/auth/types";
import { hasAcceptedRequiredPolicies, isFeatureEnabled } from "@/lib/admin/feature-flags";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

function revalidateMoveIn(id?: string) {
  revalidatePath("/dashboard/catalog/move-in");
  if (id) revalidatePath(`/dashboard/catalog/move-in/${id}`);
  revalidatePath("/admin/distribution/migration");
}

async function requireCatalogMigrationEntitlement(
  ctx: AuthUserContext
): Promise<{ ok: false; error: string } | null> {
  if (!(await hasAcceptedRequiredPolicies(ctx.userId))) {
    return { ok: false, error: "Review and accept the current Nexo policies in Account → Policies & Agreements before using Move-In." };
  }
  if (!(await isFeatureEnabled("move_in_catalog", true))) {
    return { ok: false, error: "Move-In catalog migration is temporarily paused by Nexo operations." };
  }
  const entitlements = await safeGetEntitlementsForAuth(ctx);
  if (!hasCatalogMigrationAccess(entitlements)) {
    return {
      ok: false,
      error: "Catalog migration requires a verified Pro plan. Completing checkout in the browser is not enough.",
    };
  }
  return null;
}

async function loadMigrationBundle(migrationId: string) {
  const supabase = await createClient();
  const { data: migration, error } = await supabase
    .from("catalog_migrations")
    .select("*")
    .eq("id", migrationId)
    .maybeSingle();
  if (error) throw error;
  const { data: items, error: iErr } = await supabase
    .from("catalog_migration_items")
    .select(
      "id, external_title, external_artist_name, external_upc, external_isrcs, status, selected, metadata_gaps, conflict_reason, draft_release_id"
    )
    .eq("migration_id", migrationId)
    .order("created_at", { ascending: true });
  if (iErr) throw iErr;
  return { migration, items: items ?? [] };
}

export async function createOwnMigrationAction(input: {
  title?: string;
  previousDistributor: string;
  importMethod?: MoveInImportMethod;
}): Promise<ActionResult> {
  const ctx = await RequireAuth({ redirectTo: "/login" });
  assertCanMutateCatalog(ctx);
  const denied = await requireCatalogMigrationEntitlement(ctx);
  if (denied) return denied;
  if (!input.previousDistributor?.trim()) {
    return { ok: false, error: "Previous distributor is required." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_own_catalog_migration", {
    p_title: input.title ?? null,
    p_previous_distributor: input.previousDistributor.trim(),
    p_import_method: input.importMethod ?? "manual",
    p_notes: null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateMoveIn(data?.id);
  const bundle = await loadMigrationBundle(data.id);
  return { ok: true, data: bundle };
}

export async function importOwnMigrationItemsAction(input: {
  migrationId: string;
  items: ArtistProvidedCatalogItem[];
  importMethod?: MoveInImportMethod;
}): Promise<ActionResult> {
  const ctx = await RequireAuth({ redirectTo: "/login" });
  assertCanMutateCatalog(ctx);
  const denied = await requireCatalogMigrationEntitlement(ctx);
  if (denied) return denied;
  if (!input.items?.length) {
    return { ok: false, error: "No items to import." };
  }
  const supabase = await createClient();
  // Persist import method / previous distributor notes without inventing fields
  if (input.importMethod) {
    await supabase
      .from("catalog_migrations")
      .update({
        import_method: input.importMethod,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.migrationId)
      .eq("owner_user_id", ctx.userId);
  }

  const payload = input.items.map((it) => ({
    title: it.title ?? null,
    artist_name: it.artist_name ?? null,
    upc: it.upc ?? null,
    isrcs: it.isrcs ?? [],
    tracks: it.tracks ?? [],
    track_count: it.track_count ?? (it.tracks?.length ?? null),
    previous_distributor: it.previous_distributor ?? null,
    external_release_id: it.external_release_id ?? null,
    selected: true,
  }));

  const { data, error } = await supabase.rpc("import_own_catalog_migration_items", {
    p_migration_id: input.migrationId,
    p_items: payload,
  });
  if (error) return { ok: false, error: error.message };
  revalidateMoveIn(input.migrationId);
  const bundle = await loadMigrationBundle(data.id);
  return { ok: true, data: bundle };
}

export async function setMigrationStepAction(input: {
  migrationId: string;
  step: string;
  selectedItemIds?: string[];
}): Promise<ActionResult> {
  const ctx = await RequireAuth({ redirectTo: "/login" });
  assertCanMutateCatalog(ctx);
  const denied = await requireCatalogMigrationEntitlement(ctx);
  if (denied) return denied;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_own_catalog_migration_step", {
    p_migration_id: input.migrationId,
    p_step: input.step,
    p_selected_item_ids: input.selectedItemIds ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidateMoveIn(input.migrationId);
  const bundle = await loadMigrationBundle(data.id);
  return { ok: true, data: bundle };
}

export async function moveInMigrationAction(migrationId: string): Promise<ActionResult> {
  const ctx = await RequireAuth({ redirectTo: "/login" });
  assertCanMutateCatalog(ctx);
  const denied = await requireCatalogMigrationEntitlement(ctx);
  if (denied) return denied;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("move_in_own_catalog_migration", {
    p_migration_id: migrationId,
  });
  if (error) return { ok: false, error: error.message };
  revalidateMoveIn(migrationId);
  revalidatePath("/dashboard/releases");
  const bundle = await loadMigrationBundle(data.id);
  return { ok: true, data: bundle };
}

export async function tryExternalDiscoverAction(
  source: "spotify" | "apple_music" | "other"
) {
  const ctx = await RequireAuth({ redirectTo: "/login" });
  const denied = await requireCatalogMigrationEntitlement(ctx);
  if (denied) {
    return {
      available: false as const,
      source: "unconfigured" as const,
      reason: denied.error,
      items: [] as const,
    };
  }
  return discoverExternalCatalog({ source });
}
