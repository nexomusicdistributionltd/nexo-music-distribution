import "server-only";

import { createServiceClient } from "@/lib/supabase/admin";
import type { BillingAccountType, BillingInterval, TierId } from "./plans";
import type { BillingEntitlements } from "./entitlements";

export type AdminPlanStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "expired"
  | "paused"
  | "canceled";

export type AdminPlanOverride = {
  user_id: string;
  account_type: BillingAccountType;
  plan_id: TierId;
  billing_interval: BillingInterval | null;
  status: AdminPlanStatus;
  starts_at: string;
  ends_at: string | null;
  reason: string | null;
};

export async function getAdminPlanOverride(
  userId: string
): Promise<AdminPlanOverride | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("billing_entitlement_overrides")
    .select("user_id,account_type,plan_id,billing_interval,status,starts_at,ends_at,reason")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as AdminPlanOverride | null;
}

export function applyAdminPlanOverride(
  base: BillingEntitlements,
  override: AdminPlanOverride | null,
  now = new Date()
): BillingEntitlements {
  if (!override) return base;

  const started = Date.parse(override.starts_at) <= now.getTime();
  const notEnded = !override.ends_at || Date.parse(override.ends_at) > now.getTime();
  const paidPlan = override.plan_id !== "artist_starter";
  const accessState = override.status === "active" || override.status === "trialing";
  const active = started && notEnded && accessState;
  const effectiveStatus =
    active
      ? override.status
      : override.status === "active" || override.status === "trialing"
        ? "expired"
        : override.status;

  return {
    ...base,
    accountType: override.account_type,
    planId: override.plan_id,
    paidAccess: active && paidPlan,
    status: effectiveStatus,
    interval: paidPlan ? override.billing_interval : null,
    currentPeriodEndsAt: override.ends_at,
    cancelAtPeriodEnd: false,
    grandfathered: !(active && paidPlan),
    source: "admin_override",
    policy:
      active && paidPlan
        ? `Administrative ${override.billing_interval ?? "manual"} plan grant: ${override.plan_id}.`
        : `Administrative billing state is ${effectiveStatus}; paid entitlements are off.`,
  };
}
