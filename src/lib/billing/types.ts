import "server-only";

import type { BillingAccountType, BillingInterval, PaidTierId } from "./plans";
import type { BillingSubscriptionSnapshot } from "./entitlements";

export type BillingCustomerRow = {
  id: string;
  user_id: string;
  account_type: BillingAccountType;
  paddle_customer_id: string;
  email: string | null;
  status: string | null;
};

export type BillingSubscriptionRow = {
  id: string;
  user_id: string;
  account_type: BillingAccountType;
  paddle_subscription_id: string;
  paddle_customer_id: string;
  paddle_product_id: string | null;
  paddle_price_id: string | null;
  plan_id: PaidTierId | null;
  interval: BillingInterval | null;
  status: string;
  collection_mode: string | null;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  current_period_starts_at: string | null;
  current_period_ends_at: string | null;
  scheduled_change_action: string | null;
  scheduled_change_effective_at: string | null;
  canceled_at: string | null;
  paused_at: string | null;
  occurred_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BillingTransactionRow = {
  id: string;
  user_id: string | null;
  paddle_transaction_id: string;
  paddle_subscription_id: string | null;
  paddle_customer_id: string | null;
  paddle_price_id: string | null;
  status: string;
  origin: string | null;
  currency: string | null;
  billed_at: string | null;
  created_at: string;
};

export function subscriptionRowToSnapshot(row: BillingSubscriptionRow): BillingSubscriptionSnapshot {
  return {
    userId: row.user_id,
    accountType: row.account_type,
    planId: row.plan_id,
    status: row.status,
    interval: row.interval,
    trialEndsAt: row.trial_ends_at,
    currentPeriodStartsAt: row.current_period_starts_at,
    currentPeriodEndsAt: row.current_period_ends_at,
    scheduledChangeAction: row.scheduled_change_action,
    scheduledChangeEffectiveAt: row.scheduled_change_effective_at,
    canceledAt: row.canceled_at,
    pausedAt: row.paused_at,
  };
}
