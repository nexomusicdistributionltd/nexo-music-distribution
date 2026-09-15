import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { billingAccountTypeFromRoles } from "./eligibility";
import type { BillingAccountType } from "./plans";
import { shouldApplyOccurredAt } from "./webhook-map";
import type {
  MappedCustomer,
  MappedSubscription,
  MappedTransaction,
  PaddleWebhookEnvelope,
} from "./webhook-map";
import { checkoutIntentIdFromCustomData } from "./webhook-map";
import { mapPaddleCustomer, mapPaddleSubscription, mapPaddleTransaction } from "./webhook-map";

export type CheckoutIntentRow = {
  id: string;
  user_id: string;
  account_type: BillingAccountType;
  plan_id: string;
  interval: string;
  paddle_price_id: string;
  status: string;
};

async function findUserByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<{ id: string; account_type: string } | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, account_type")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return data ?? null;
}

async function consumeIntent(
  supabase: SupabaseClient,
  intentId: string | null
): Promise<CheckoutIntentRow | null> {
  if (!intentId) return null;
  const { data } = await supabase
    .from("billing_checkout_intents")
    .select("*")
    .eq("id", intentId)
    .maybeSingle();
  if (!data) return null;
  if (data.status !== "pending") return data as CheckoutIntentRow;
  if (data.expires_at && Date.parse(data.expires_at) < Date.now()) return null;
  await supabase
    .from("billing_checkout_intents")
    .update({ status: "consumed", consumed_at: new Date().toISOString() })
    .eq("id", intentId)
    .eq("status", "pending");
  return data as CheckoutIntentRow;
}

async function resolveUserForPaddle(input: {
  supabase: SupabaseClient;
  paddleCustomerId: string | null;
  email: string | null;
  customData: unknown;
}): Promise<{ userId: string; accountType: BillingAccountType } | null> {
  const intent = await consumeIntent(
    input.supabase,
    checkoutIntentIdFromCustomData(input.customData)
  );
  if (intent) {
    return { userId: intent.user_id, accountType: intent.account_type };
  }

  if (input.paddleCustomerId) {
    const { data: customer } = await input.supabase
      .from("billing_customers")
      .select("user_id, account_type")
      .eq("paddle_customer_id", input.paddleCustomerId)
      .maybeSingle();
    if (customer) {
      return { userId: customer.user_id, accountType: customer.account_type };
    }
  }

  if (input.email) {
    const profile = await findUserByEmail(input.supabase, input.email);
    if (profile) {
      const accountType = billingAccountTypeFromRoles([], profile.account_type);
      if (accountType) return { userId: profile.id, accountType };
    }
  }

  return null;
}

export async function recordWebhookEvent(input: {
  supabase: SupabaseClient;
  envelope: PaddleWebhookEnvelope;
}): Promise<{ duplicate: boolean; processed: boolean }> {
  const { error } = await input.supabase.from("billing_webhook_events").insert({
    paddle_event_id: input.envelope.eventId,
    event_type: input.envelope.eventType,
    notification_id: input.envelope.notificationId,
    occurred_at: input.envelope.occurredAt,
    payload: {
      event_type: input.envelope.eventType,
      data: input.envelope.data,
    },
    processed: false,
  });
  if (error) {
    if (error.code === "23505") {
      const { data } = await input.supabase
        .from("billing_webhook_events")
        .select("processed")
        .eq("paddle_event_id", input.envelope.eventId)
        .maybeSingle();
      return { duplicate: true, processed: Boolean(data?.processed) };
    }
    throw error;
  }
  return { duplicate: false, processed: false };
}

export async function markWebhookProcessed(
  supabase: SupabaseClient,
  eventId: string,
  processError?: string | null
) {
  await supabase
    .from("billing_webhook_events")
    .update({
      processed: true,
      processed_at: new Date().toISOString(),
      process_error: processError ?? null,
    })
    .eq("paddle_event_id", eventId);
}

async function upsertCustomer(
  supabase: SupabaseClient,
  mapped: MappedCustomer,
  owner: { userId: string; accountType: BillingAccountType } | null
) {
  if (!owner) return;
  await supabase.from("billing_customers").upsert(
    {
      user_id: owner.userId,
      account_type: owner.accountType,
      paddle_customer_id: mapped.paddleCustomerId,
      email: mapped.email,
      status: mapped.status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "paddle_customer_id" }
  );
}

async function upsertSubscription(
  supabase: SupabaseClient,
  mapped: MappedSubscription,
  owner: { userId: string; accountType: BillingAccountType }
) {
  const { data: existing } = await supabase
    .from("billing_subscriptions")
    .select("occurred_at")
    .eq("paddle_subscription_id", mapped.paddleSubscriptionId)
    .maybeSingle();

  if (existing && !shouldApplyOccurredAt(mapped.occurredAt, existing.occurred_at)) {
    return;
  }

  await supabase.from("billing_subscriptions").upsert(
    {
      user_id: owner.userId,
      account_type: owner.accountType,
      paddle_subscription_id: mapped.paddleSubscriptionId,
      paddle_customer_id: mapped.paddleCustomerId,
      paddle_product_id: mapped.paddleProductId,
      paddle_price_id: mapped.paddlePriceId,
      plan_id: mapped.planId,
      interval: mapped.interval,
      status: mapped.status,
      collection_mode: mapped.collectionMode,
      trial_starts_at: mapped.trialStartsAt,
      trial_ends_at: mapped.trialEndsAt,
      current_period_starts_at: mapped.currentPeriodStartsAt,
      current_period_ends_at: mapped.currentPeriodEndsAt,
      scheduled_change_action: mapped.scheduledChangeAction,
      scheduled_change_effective_at: mapped.scheduledChangeEffectiveAt,
      canceled_at: mapped.canceledAt,
      paused_at: mapped.pausedAt,
      custom_data: mapped.customData ?? {},
      occurred_at: mapped.occurredAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "paddle_subscription_id" }
  );
}

async function upsertTransaction(
  supabase: SupabaseClient,
  mapped: MappedTransaction,
  owner: { userId: string; accountType: BillingAccountType } | null
) {
  await supabase.from("billing_transactions").upsert(
    {
      user_id: owner?.userId ?? null,
      paddle_transaction_id: mapped.paddleTransactionId,
      paddle_subscription_id: mapped.paddleSubscriptionId,
      paddle_customer_id: mapped.paddleCustomerId,
      paddle_price_id: mapped.paddlePriceId,
      status: mapped.status,
      origin: mapped.origin,
      currency: mapped.currency,
      totals: mapped.totals ?? {},
      billed_at: mapped.billedAt,
      custom_data: mapped.customData ?? {},
      occurred_at: mapped.occurredAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "paddle_transaction_id" }
  );
}

export async function applyPaddleWebhookEvent(input: {
  supabase: SupabaseClient;
  envelope: PaddleWebhookEnvelope;
}): Promise<{ applied: boolean; reason?: string }> {
  const { envelope, supabase } = input;
  const type = envelope.eventType;

  if (type.startsWith("customer.")) {
    const mapped = mapPaddleCustomer(envelope.data);
    if (!mapped) return { applied: false, reason: "unmapped_customer" };
    const owner = await resolveUserForPaddle({
      supabase,
      paddleCustomerId: mapped.paddleCustomerId,
      email: mapped.email,
      customData: envelope.data.customData ?? envelope.data.custom_data,
    });
    await upsertCustomer(supabase, mapped, owner);
    return { applied: true };
  }

  if (type.startsWith("subscription.")) {
    const mapped = mapPaddleSubscription(envelope.data, envelope.occurredAt);
    if (!mapped) return { applied: false, reason: "unmapped_subscription" };
    const owner = await resolveUserForPaddle({
      supabase,
      paddleCustomerId: mapped.paddleCustomerId,
      email: null,
      customData: mapped.customData,
    });
    if (!owner) return { applied: false, reason: "unresolved_user" };
    await upsertCustomer(
      supabase,
      {
        paddleCustomerId: mapped.paddleCustomerId,
        email: null,
        status: "active",
        name: null,
      },
      owner
    );
    await upsertSubscription(supabase, mapped, owner);
    return { applied: true };
  }

  if (type.startsWith("transaction.")) {
    const mapped = mapPaddleTransaction(envelope.data, envelope.occurredAt);
    if (!mapped) return { applied: false, reason: "unmapped_transaction" };
    const owner = await resolveUserForPaddle({
      supabase,
      paddleCustomerId: mapped.paddleCustomerId,
      email: null,
      customData: mapped.customData,
    });
    await upsertTransaction(supabase, mapped, owner);
    return { applied: true };
  }

  return { applied: false, reason: "ignored_event" };
}
