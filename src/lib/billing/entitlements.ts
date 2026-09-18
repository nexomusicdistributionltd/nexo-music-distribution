import type { BillingAccountType, BillingInterval, TierId } from "./plans";

export type PaddleSubscriptionStatus =
  | "active"
  | "trialing"
  | "canceled"
  | "paused"
  | "past_due";

export type BillingSubscriptionSnapshot = {
  userId: string;
  accountType: BillingAccountType;
  planId: TierId | null;
  status: PaddleSubscriptionStatus | string;
  interval: BillingInterval | null;
  trialEndsAt: string | null;
  currentPeriodStartsAt: string | null;
  currentPeriodEndsAt: string | null;
  scheduledChangeAction: string | null;
  scheduledChangeEffectiveAt: string | null;
  canceledAt: string | null;
  pausedAt: string | null;
};

export type BillingEntitlements = {
  accountType: BillingAccountType | null;
  planId: TierId | null;
  /** active + trialing grant paid access. */
  paidAccess: boolean;
  status: string | null;
  interval: BillingInterval | null;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  /** Existing production features remain available without a Paddle subscription. */
  grandfathered: boolean;
  source: "paddle" | "artist_starter" | "grandfathered" | "admin_override" | "none";
  policy: string;
};

function isFuture(iso: string | null | undefined, now: Date): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return t > now.getTime();
}

/**
 * Deliberate Paddle-aligned access policy:
 * - active and trialing grant paid access
 * - scheduled cancellation keeps access until the change takes effect
 *   (Paddle keeps status=active with scheduledChange.action=cancel)
 * - canceled (effective) does not grant paid access
 * - paused does not grant paid access
 * - past_due does not grant paid access until Paddle returns the subscription to active/trialing
 *
 * Catalog data is never deleted on billing change.
 */
export function subscriptionGrantsPaidAccess(
  sub: Pick<
    BillingSubscriptionSnapshot,
    "status" | "scheduledChangeAction" | "scheduledChangeEffectiveAt" | "currentPeriodEndsAt"
  > | null,
  now: Date = new Date()
): boolean {
  if (!sub) return false;
  const status = sub.status;
  if (status === "active" || status === "trialing") return true;
  if (
    status === "canceled" &&
    sub.scheduledChangeAction === "cancel" &&
    isFuture(sub.scheduledChangeEffectiveAt ?? sub.currentPeriodEndsAt, now)
  ) {
    return true;
  }
  return false;
}

export function getBillingEntitlements(input: {
  accountType: BillingAccountType | null;
  subscription: BillingSubscriptionSnapshot | null;
  now?: Date;
}): BillingEntitlements {
  const now = input.now ?? new Date();
  const sub = input.subscription;
  const paidAccess = subscriptionGrantsPaidAccess(sub, now);
  const cancelAtPeriodEnd =
    Boolean(sub) &&
    (sub?.scheduledChangeAction === "cancel" ||
      (sub?.status === "active" && Boolean(sub.scheduledChangeEffectiveAt)));

  if (sub && paidAccess) {
    return {
      accountType: input.accountType ?? sub.accountType,
      planId: sub.planId,
      paidAccess: true,
      status: sub.status,
      interval: sub.interval,
      trialEndsAt: sub.trialEndsAt,
      currentPeriodEndsAt: sub.currentPeriodEndsAt,
      cancelAtPeriodEnd,
      grandfathered: false,
      source: "paddle",
      policy: "Paid access from verified Paddle subscription (active or trialing).",
    };
  }

  if (sub && !paidAccess) {
    return {
      accountType: input.accountType ?? sub.accountType,
      planId: sub.planId,
      paidAccess: false,
      status: sub.status,
      interval: sub.interval,
      trialEndsAt: sub.trialEndsAt,
      currentPeriodEndsAt: sub.currentPeriodEndsAt,
      cancelAtPeriodEnd,
      grandfathered: true,
      source: "paddle",
      policy:
        "Paddle subscription is not in a paid state (paused/past_due/canceled). Existing catalog features remain available (grandfathered); paid entitlements are off.",
    };
  }

  if (input.accountType === "artist") {
    return {
      accountType: "artist",
      planId: "artist_starter",
      paidAccess: false,
      status: null,
      interval: null,
      trialEndsAt: null,
      currentPeriodEndsAt: null,
      cancelAtPeriodEnd: false,
      grandfathered: true,
      source: "artist_starter",
      policy:
        "Artist Starter is free and does not use Paddle. Existing production features stay available.",
    };
  }

  return {
    accountType: input.accountType,
    planId: null,
    paidAccess: false,
    status: null,
    interval: null,
    trialEndsAt: null,
    currentPeriodEndsAt: null,
    cancelAtPeriodEnd: false,
    grandfathered: true,
    source: input.accountType ? "grandfathered" : "none",
    policy:
      "No Paddle subscription. Existing production features stay available (soft-gate / grandfather). Paid access is not granted.",
  };
}

/** Alias required by the billing brief. */
export const getSubscriptionAccess = getBillingEntitlements;
