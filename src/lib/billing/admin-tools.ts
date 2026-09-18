import "server-only";

import { createServiceClient } from "@/lib/supabase/admin";
import {
  applyAdminPlanOverride,
  type AdminPlanOverride,
} from "@/lib/billing/admin-overrides";
import {
  getBillingEntitlements,
  type BillingEntitlements,
} from "@/lib/billing/entitlements";
import {
  subscriptionRowToSnapshot,
  type BillingSubscriptionRow,
} from "@/lib/billing/types";
import type { BillingAccountType } from "@/lib/billing/plans";

export type BillingToolUser = {
  userId: string;
  email: string | null;
  name: string | null;
  accountType: BillingAccountType;
  paddle: BillingSubscriptionRow | null;
  override: AdminPlanOverride | null;
  effective: BillingEntitlements;
  providerReleaseCount: number;
};

export type BillingToolListResult = {
  rows: BillingToolUser[];
  error: string | null;
};

function safeSearchTerm(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/[^a-zA-Z0-9@.+ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function statusRank(status: string): number {
  if (status === "active" || status === "trialing") return 0;
  if (status === "past_due") return 1;
  if (status === "paused") return 2;
  if (status === "canceled") return 3;
  return 4;
}

function primarySubscription(rows: BillingSubscriptionRow[]): BillingSubscriptionRow | null {
  return [...rows].sort((a, b) => {
    const byStatus = statusRank(a.status) - statusRank(b.status);
    if (byStatus !== 0) return byStatus;
    return Date.parse(b.updated_at) - Date.parse(a.updated_at);
  })[0] ?? null;
}

export async function listBillingToolUsers(input: {
  q?: string | null;
  accountType?: BillingAccountType | null;
}): Promise<BillingToolListResult> {
  try {
    const db = createServiceClient();
    let profilesQuery = db
      .from("profiles")
      .select("id,email,display_name,full_name,account_type")
      .in("account_type", ["artist", "label"])
      .order("email", { ascending: true })
      .limit(100);

    if (input.accountType) profilesQuery = profilesQuery.eq("account_type", input.accountType);

    const search = safeSearchTerm(input.q);
    if (search) {
      const looksUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(search);
      profilesQuery = looksUuid
        ? profilesQuery.eq("id", search)
        : profilesQuery.or(
            `email.ilike.%${search}%,display_name.ilike.%${search}%,full_name.ilike.%${search}%`
          );
    }

    const { data: profiles, error: profileError } = await profilesQuery;
    if (profileError) return { rows: [], error: profileError.message };
    if (!profiles?.length) return { rows: [], error: null };

    const userIds = profiles.map((profile) => profile.id);

    const [subscriptionResult, overrideResult, releaseResult] = await Promise.all([
      db
        .from("billing_subscriptions")
        .select("*")
        .in("user_id", userIds)
        .order("updated_at", { ascending: false }),
      db
        .from("billing_entitlement_overrides")
        .select(
          "user_id,account_type,plan_id,billing_interval,status,starts_at,ends_at,reason"
        )
        .in("user_id", userIds),
      db
        .from("releases")
        .select("id,owner_user_id")
        .in("owner_user_id", userIds)
        .limit(2000),
    ]);

    const sourceError =
      subscriptionResult.error ?? overrideResult.error ?? releaseResult.error;
    if (sourceError) return { rows: [], error: sourceError.message };

    const subscriptions = subscriptionResult.data;
    const overrides = overrideResult.data;
    const ownedReleases = releaseResult.data;

    const releaseOwner = new Map<string, string>();
    for (const release of ownedReleases ?? []) {
      if (release.id && release.owner_user_id) {
        releaseOwner.set(release.id, release.owner_user_id);
      }
    }

    const releaseIds = [...releaseOwner.keys()];
    const providerCount = new Map<string, number>();
    if (releaseIds.length > 0) {
      const { data: providerLinks } = await db
        .from("provider_release_links")
        .select("release_id")
        .eq("provider_name", "distribution_engine")
        .in("release_id", releaseIds);

      for (const link of providerLinks ?? []) {
        const owner = releaseOwner.get(link.release_id);
        if (owner) providerCount.set(owner, (providerCount.get(owner) ?? 0) + 1);
      }
    }

    const subscriptionsByUser = new Map<string, BillingSubscriptionRow[]>();
    for (const subscription of (subscriptions ?? []) as BillingSubscriptionRow[]) {
      const list = subscriptionsByUser.get(subscription.user_id) ?? [];
      list.push(subscription);
      subscriptionsByUser.set(subscription.user_id, list);
    }

    const overridesByUser = new Map<string, AdminPlanOverride>();
    for (const override of (overrides ?? []) as AdminPlanOverride[]) {
      overridesByUser.set(override.user_id, override);
    }

    const rows: BillingToolUser[] = profiles.map((profile) => {
      const accountType = profile.account_type as BillingAccountType;
      const paddle = primarySubscription(subscriptionsByUser.get(profile.id) ?? []);
      const override = overridesByUser.get(profile.id) ?? null;
      const base = getBillingEntitlements({
        accountType,
        subscription: paddle ? subscriptionRowToSnapshot(paddle) : null,
      });

      return {
        userId: profile.id,
        email: profile.email ?? null,
        name: profile.display_name || profile.full_name || null,
        accountType,
        paddle,
        override,
        effective: applyAdminPlanOverride(base, override),
        providerReleaseCount: providerCount.get(profile.id) ?? 0,
      };
    });

    return { rows, error: null };
  } catch (error) {
    return {
      rows: [],
      error: error instanceof Error ? error.message : "Could not load billing tools.",
    };
  }
}
