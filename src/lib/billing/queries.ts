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
import { adminListErrorMessage, isMissingRelationError } from "@/lib/db/admin-query";
import {
  attachProfilesToBillingRows,
  type AdminBillingSubscriptionRow,
  type BillingProfileLite,
} from "./admin-display";

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

export type AdminBillingListResult = {
  rows: AdminBillingSubscriptionRow[];
  error: string | null;
};

function sanitizeBillingFilterToken(raw: string): string | null {
  const q = raw.trim();
  if (!q || q.length > 120) return null;
  if (!/^[a-zA-Z0-9_@.+-]+$/.test(q)) return null;
  return q;
}

async function profileIdsMatchingBillingSearch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  q: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .or(`email.ilike.%${q}%,display_name.ilike.%${q}%,full_name.ilike.%${q}%`)
    .limit(50);
  if (error || !data) return [];
  return data.map((row) => row.id);
}

/**
 * Admin billing list. Missing Paddle tables / query errors return [] plus a
 * truthful error string — never throw into the Next.js “something went wrong” page.
 * Does not invent subscriptions.
 */
export async function listBillingSubscriptionsAdmin(
  filters: AdminBillingFilters
): Promise<AdminBillingListResult> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("billing_subscriptions")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);

    if (filters.status) query = query.eq("status", filters.status);
    if (filters.accountType) query = query.eq("account_type", filters.accountType);
    if (filters.planId) query = query.eq("plan_id", filters.planId);

    const rawQ = filters.q?.trim() ?? "";
    const q = sanitizeBillingFilterToken(rawQ);
    if (q) {
      const parts: string[] = [];
      const looksUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(q);
      if (looksUuid) parts.push(`user_id.eq.${q}`);
      if (!q.includes("@")) {
        parts.push(`paddle_subscription_id.eq.${q}`, `paddle_customer_id.eq.${q}`);
      }
      const profileIds = await profileIdsMatchingBillingSearch(supabase, q);
      if (profileIds.length > 0) {
        parts.push(`user_id.in.(${profileIds.join(",")})`);
      }
      if (parts.length > 0) query = query.or(parts.join(","));
      else {
        return { rows: [], error: null };
      }
    }

    const { data, error } = await query;
    if (error) {
      return { rows: [], error: adminListErrorMessage(error) };
    }

    const rows = (data as BillingSubscriptionRow[]) ?? [];
    if (rows.length === 0) return { rows: [], error: null };

    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    let profiles: BillingProfileLite[] = [];
    if (userIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, display_name, full_name")
        .in("id", userIds);
      if (!profileError && profileRows) {
        profiles = profileRows as BillingProfileLite[];
      }
    }

    return { rows: attachProfilesToBillingRows(rows, profiles), error: null };
  } catch (error) {
    const extracted =
      error && typeof error === "object"
        ? (error as { message?: string; code?: string })
        : { message: error instanceof Error ? error.message : undefined };
    if (isMissingRelationError(extracted) || extracted.message) {
      return { rows: [], error: adminListErrorMessage(extracted) };
    }
    return { rows: [], error: "Could not load billing subscriptions." };
  }
}
