import "server-only";

import { createClient } from "@/lib/supabase/server";
import { billingAccountTypeFromRoles } from "./eligibility";
import { getBillingEntitlements, type BillingEntitlements } from "./entitlements";
import type { BillingAccountType } from "./plans";
import {
  subscriptionRowToSnapshot,
  type BillingCustomerRow,
  type BillingSubscriptionRow,
  type BillingTransactionRow,
} from "./types";
import type { AppRole, AuthUserContext } from "@/lib/auth/types";

export async function getOwnBillingCustomer(
  userId: string
): Promise<BillingCustomerRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("billing_customers")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as BillingCustomerRow | null) ?? null;
}

export async function getOwnBillingSubscriptions(
  userId: string
): Promise<BillingSubscriptionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as BillingSubscriptionRow[]) ?? [];
}

export async function getOwnBillingTransactions(
  userId: string,
  limit = 20
): Promise<BillingTransactionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("billing_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as BillingTransactionRow[]) ?? [];
}

export function primarySubscription(
  rows: BillingSubscriptionRow[]
): BillingSubscriptionRow | null {
  const rank = (status: string) => {
    if (status === "active" || status === "trialing") return 0;
    if (status === "past_due") return 1;
    if (status === "paused") return 2;
    return 3;
  };
  const sorted = [...rows].sort((a, b) => rank(a.status) - rank(b.status));
  return sorted[0] ?? null;
}

export async function getEntitlementsForUser(input: {
  userId: string;
  roles: AppRole[];
  profileAccountType?: string | null;
}): Promise<BillingEntitlements> {
  const accountType = billingAccountTypeFromRoles(input.roles, input.profileAccountType);
  const rows = await getOwnBillingSubscriptions(input.userId);
  const primary = primarySubscription(rows);
  return getBillingEntitlements({
    accountType,
    subscription: primary ? subscriptionRowToSnapshot(primary) : null,
  });
}

export async function getEntitlementsForAuth(ctx: AuthUserContext): Promise<BillingEntitlements> {
  return getEntitlementsForUser({
    userId: ctx.userId,
    roles: ctx.roles,
    profileAccountType: ctx.profile?.account_type,
  });
}

/** Never throw from dashboard rendering — fall back to grandfathered starter access. */
export async function safeGetEntitlementsForAuth(ctx: AuthUserContext): Promise<BillingEntitlements> {
  try {
    return await getEntitlementsForAuth(ctx);
  } catch {
    return getBillingEntitlements({
      accountType: billingAccountTypeFromRoles(ctx.roles, ctx.profile?.account_type),
      subscription: null,
    });
  }
}

export type AdminBillingFilters = {
  status?: string | null;
  accountType?: BillingAccountType | null;
  planId?: string | null;
  q?: string | null;
};

export async function listBillingSubscriptionsAdmin(
  filters: AdminBillingFilters
): Promise<BillingSubscriptionRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("billing_subscriptions")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.accountType) query = query.eq("account_type", filters.accountType);
  if (filters.planId) query = query.eq("plan_id", filters.planId);
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    query = query.or(
      `paddle_subscription_id.eq.${q},paddle_customer_id.eq.${q},user_id.eq.${q}`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as BillingSubscriptionRow[]) ?? [];
}
