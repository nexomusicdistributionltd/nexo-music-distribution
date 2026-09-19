import "server-only";

import { createServiceClient } from "@/lib/supabase/admin";

export type RoyaltyCommissionPolicy = {
  artistPaidBps: number;
  artistFreeBps: number;
  labelPaidBps: number;
  labelFreeBps: number;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type RoyaltyCommissionPolicyHistoryRow = {
  id: string;
  artistPaidBps: number;
  artistFreeBps: number;
  labelPaidBps: number;
  labelFreeBps: number;
  reason: string | null;
  changedBy: string | null;
  createdAt: string;
};

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function getRoyaltyCommissionPolicy(): Promise<RoyaltyCommissionPolicy> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("royalty_commission_policy")
    .select(
      "artist_paid_bps,artist_free_bps,label_paid_bps,label_free_bps,paid_plan_bps,free_plan_bps,updated_at,updated_by"
    )
    .eq("id", "default")
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("Royalty commission policy is not configured.");
  }

  const paidFallback = numberValue(data.paid_plan_bps, 1000);
  const freeFallback = numberValue(data.free_plan_bps, 2000);

  return {
    artistPaidBps: numberValue(data.artist_paid_bps, paidFallback),
    artistFreeBps: numberValue(data.artist_free_bps, freeFallback),
    labelPaidBps: numberValue(data.label_paid_bps, paidFallback),
    labelFreeBps: numberValue(data.label_free_bps, freeFallback),
    updatedAt: data.updated_at ?? null,
    updatedBy: data.updated_by ?? null,
  };
}

export async function listRoyaltyCommissionPolicyHistory(
  limit = 12
): Promise<RoyaltyCommissionPolicyHistoryRow[]> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("royalty_commission_policy_history")
    .select(
      "id,artist_paid_bps,artist_free_bps,label_paid_bps,label_free_bps,reason,changed_by,created_at"
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(50, Math.max(1, limit)));

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    artistPaidBps: row.artist_paid_bps,
    artistFreeBps: row.artist_free_bps,
    labelPaidBps: row.label_paid_bps,
    labelFreeBps: row.label_free_bps,
    reason: row.reason ?? null,
    changedBy: row.changed_by ?? null,
    createdAt: row.created_at,
  }));
}

export function bpsToPercent(bps: number): string {
  return (bps / 100).toFixed(2).replace(/\.00$/, "");
}
