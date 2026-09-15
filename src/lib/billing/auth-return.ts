import { COMPANY_LEGAL, SITE_URL } from "@/lib/site";
import type { BillingAccountType, BillingInterval, PaidTierId } from "./plans";
import { isBillingInterval, isPaidTierId, isTierId } from "./plans";

export function billingCheckoutReturnPath(input: {
  planId: string;
  interval: BillingInterval;
}): string {
  const q = new URLSearchParams();
  q.set("plan", input.planId);
  q.set("interval", input.interval);
  q.set("checkout", "1");
  return `/pricing?${q.toString()}`;
}

export function loginHrefForPlan(input: {
  planId: string;
  interval: BillingInterval;
}): string {
  const from = billingCheckoutReturnPath(input);
  const q = new URLSearchParams();
  q.set("from", from);
  q.set("plan", input.planId);
  q.set("interval", input.interval);
  q.set("reason", "auth-required");
  return `/login?${q.toString()}`;
}

export function registerHrefForPlan(input: {
  planId: string;
  interval: BillingInterval;
  accountType: BillingAccountType;
}): string {
  const from = billingCheckoutReturnPath(input);
  const q = new URLSearchParams();
  q.set("type", input.accountType);
  q.set("plan", input.planId);
  q.set("interval", input.interval);
  q.set("from", from);
  return `/register?${q.toString()}`;
}

export function parseBillingSelection(input: {
  plan?: string | null;
  interval?: string | null;
}): { planId: PaidTierId; interval: BillingInterval } | null {
  const plan = input.plan?.trim() ?? "";
  const interval = input.interval?.trim() ?? "";
  if (!isPaidTierId(plan) || !isBillingInterval(interval)) return null;
  return { planId: plan, interval };
}

export function preserveBillingQuery(search: URLSearchParams | { get(name: string): string | null }): string {
  const q = new URLSearchParams();
  const plan = search.get("plan");
  const interval = search.get("interval");
  const from = search.get("from");
  if (plan && isTierId(plan)) q.set("plan", plan);
  if (interval && isBillingInterval(interval)) q.set("interval", interval);
  if (from?.startsWith("/") && !from.startsWith("//")) q.set("from", from);
  const qs = q.toString();
  return qs ? `?${qs}` : "";
}

export function checkoutSuccessPath(): string {
  return "/billing/success";
}

export function checkoutSuccessUrl(origin = SITE_URL): string {
  return `${origin.replace(/\/$/, "")}${checkoutSuccessPath()}`;
}

export function termsHref() {
  return "/terms";
}

export function privacyHref() {
  return "/privacy";
}

export function returnPolicyHref() {
  return "/refund-policy";
}

export function legalMerchantName() {
  return COMPANY_LEGAL;
}
