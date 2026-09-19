import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function isFeatureEnabled(key: string, fallback = true): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_feature_flags")
    .select("enabled")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return fallback;
  return data.enabled === true;
}

export async function getUserOperationalHolds(userId: string): Promise<{
  payoutHold: boolean;
  distributionHold: boolean;
  taxHold: boolean;
  activeCaseCount: number;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nexo_user_operational_holds", {
    p_user_id: userId,
  });
  if (error || !data || typeof data !== "object") {
    return { payoutHold: false, distributionHold: false, taxHold: false, activeCaseCount: 0 };
  }
  const value = data as Record<string, unknown>;
  return {
    payoutHold: value.payout_hold === true,
    distributionHold: value.distribution_hold === true,
    taxHold: value.tax_hold === true,
    activeCaseCount: Number(value.active_case_count ?? 0) || 0,
  };
}
