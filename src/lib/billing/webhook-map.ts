import { planFromApprovedPriceId, type BillingInterval, type PaidTierId } from "./plans";

/** Official Paddle Billing event names we handle. Do not invent Classic names. */
export const HANDLED_PADDLE_EVENTS = [
  "subscription.created",
  "subscription.updated",
  "subscription.canceled",
  "subscription.trialing",
  "subscription.activated",
  "subscription.past_due",
  "subscription.paused",
  "subscription.resumed",
  "customer.created",
  "customer.updated",
  "transaction.completed",
  "transaction.payment_failed",
  "transaction.past_due",
] as const;

export type HandledPaddleEvent = (typeof HANDLED_PADDLE_EVENTS)[number];

export function isHandledPaddleEvent(eventType: string): eventType is HandledPaddleEvent {
  return (HANDLED_PADDLE_EVENTS as readonly string[]).includes(eventType);
}

export type PaddleWebhookEnvelope = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  notificationId?: string | null;
  data: Record<string, unknown>;
};

export type MappedCustomer = {
  paddleCustomerId: string;
  email: string | null;
  status: string | null;
  name: string | null;
};

export type MappedSubscription = {
  paddleSubscriptionId: string;
  paddleCustomerId: string;
  paddleProductId: string | null;
  paddlePriceId: string | null;
  status: string;
  interval: BillingInterval | null;
  planId: PaidTierId | null;
  collectionMode: string | null;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStartsAt: string | null;
  currentPeriodEndsAt: string | null;
  scheduledChangeAction: string | null;
  scheduledChangeEffectiveAt: string | null;
  canceledAt: string | null;
  pausedAt: string | null;
  customData: Record<string, unknown> | null;
  occurredAt: string;
};

export type MappedTransaction = {
  paddleTransactionId: string;
  paddleSubscriptionId: string | null;
  paddleCustomerId: string | null;
  paddlePriceId: string | null;
  status: string;
  origin: string | null;
  currency: string | null;
  totals: Record<string, unknown> | null;
  billedAt: string | null;
  customData: Record<string, unknown> | null;
  occurredAt: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function camelOrSnake(obj: Record<string, unknown>, camel: string, snake: string): unknown {
  return obj[camel] ?? obj[snake];
}

export function checkoutIntentIdFromCustomData(customData: unknown): string | null {
  const rec = asRecord(customData);
  if (!rec) return null;
  return asString(rec.nexo_checkout_intent_id);
}

export function mapPaddleCustomer(data: Record<string, unknown>): MappedCustomer | null {
  const id = asString(data.id);
  if (!id?.startsWith("ctm_")) return null;
  return {
    paddleCustomerId: id,
    email: asString(data.email),
    status: asString(data.status),
    name: asString(data.name),
  };
}

function mapInterval(billingCycle: unknown): BillingInterval | null {
  const rec = asRecord(billingCycle);
  if (!rec) return null;
  const interval = asString(camelOrSnake(rec, "interval", "interval"));
  if (interval === "month" || interval === "year") return interval;
  return null;
}

function firstItem(data: Record<string, unknown>): Record<string, unknown> | null {
  const items = data.items;
  if (!Array.isArray(items) || items.length === 0) return null;
  return asRecord(items[0]);
}

export function mapPaddleSubscription(
  data: Record<string, unknown>,
  occurredAt: string,
  env: NodeJS.ProcessEnv = process.env
): MappedSubscription | null {
  const id = asString(data.id);
  const customerId = asString(camelOrSnake(data, "customerId", "customer_id"));
  if (!id?.startsWith("sub_") || !customerId) return null;

  const item = firstItem(data);
  const price = item ? asRecord(item.price) : null;
  const product = item ? asRecord(item.product) : asRecord(price?.product);
  const paddlePriceId = asString(price?.id);
  const paddleProductId = asString(product?.id) ?? asString(price ? camelOrSnake(price, "productId", "product_id") : null);
  const mappedPlan = planFromApprovedPriceId(paddlePriceId, env);

  const period = asRecord(camelOrSnake(data, "currentBillingPeriod", "current_billing_period"));
  const trialDates = item ? asRecord(camelOrSnake(item, "trialDates", "trial_dates")) : null;
  const scheduled = asRecord(camelOrSnake(data, "scheduledChange", "scheduled_change"));
  const billingCycle = camelOrSnake(data, "billingCycle", "billing_cycle");
  const customData = asRecord(camelOrSnake(data, "customData", "custom_data"));

  return {
    paddleSubscriptionId: id,
    paddleCustomerId: customerId,
    paddleProductId,
    paddlePriceId,
    status: asString(data.status) ?? "unknown",
    interval: mappedPlan?.interval ?? mapInterval(billingCycle),
    planId: mappedPlan?.tierId ?? null,
    collectionMode: asString(camelOrSnake(data, "collectionMode", "collection_mode")),
    trialStartsAt: trialDates ? asString(camelOrSnake(trialDates, "startsAt", "starts_at")) : null,
    trialEndsAt: trialDates ? asString(camelOrSnake(trialDates, "endsAt", "ends_at")) : null,
    currentPeriodStartsAt: period ? asString(camelOrSnake(period, "startsAt", "starts_at")) : null,
    currentPeriodEndsAt: period ? asString(camelOrSnake(period, "endsAt", "ends_at")) : null,
    scheduledChangeAction: scheduled ? asString(scheduled.action) : null,
    scheduledChangeEffectiveAt: scheduled
      ? asString(camelOrSnake(scheduled, "effectiveAt", "effective_at"))
      : null,
    canceledAt: asString(camelOrSnake(data, "canceledAt", "canceled_at")),
    pausedAt: asString(camelOrSnake(data, "pausedAt", "paused_at")),
    customData,
    occurredAt,
  };
}

export function mapPaddleTransaction(
  data: Record<string, unknown>,
  occurredAt: string
): MappedTransaction | null {
  const id = asString(data.id);
  if (!id?.startsWith("txn_")) return null;
  const items = Array.isArray(data.items) ? data.items : [];
  const first = items.length ? asRecord(items[0]) : null;
  const price = first ? asRecord(first.price) : null;
  const details = asRecord(data.details);
  const totals = details ? asRecord(details.totals) : null;
  return {
    paddleTransactionId: id,
    paddleSubscriptionId: asString(camelOrSnake(data, "subscriptionId", "subscription_id")),
    paddleCustomerId: asString(camelOrSnake(data, "customerId", "customer_id")),
    paddlePriceId: asString(price?.id),
    status: asString(data.status) ?? "unknown",
    origin: asString(data.origin),
    currency: asString(camelOrSnake(data, "currencyCode", "currency_code")),
    totals,
    billedAt: asString(camelOrSnake(data, "billedAt", "billed_at")),
    customData: asRecord(camelOrSnake(data, "customData", "custom_data")),
    occurredAt,
  };
}

/** Out-of-order guard: apply only if incoming occurred_at is >= stored. */
export function shouldApplyOccurredAt(
  incomingOccurredAt: string,
  storedOccurredAt: string | null | undefined
): boolean {
  if (!storedOccurredAt) return true;
  const incoming = Date.parse(incomingOccurredAt);
  const stored = Date.parse(storedOccurredAt);
  if (Number.isNaN(incoming)) return false;
  if (Number.isNaN(stored)) return true;
  return incoming >= stored;
}

export function envelopeFromSdkEvent(event: {
  eventId: string;
  eventType: string;
  occurredAt: string;
  notificationId?: string | null;
  data: unknown;
}): PaddleWebhookEnvelope {
  return {
    eventId: event.eventId,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    notificationId: event.notificationId ?? null,
    data: asRecord(event.data) ?? {},
  };
}
