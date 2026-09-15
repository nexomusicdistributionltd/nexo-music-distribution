import "server-only";

import { authorizeCheckout, type CheckoutRequest, type ForbiddenClientCheckoutFields } from "./eligibility";
import type { AppRole } from "@/lib/auth/types";
import { checkoutSuccessUrl } from "./auth-return";
import { getSiteUrl } from "@/lib/site-url";

export type CheckoutOpenPayload = {
  priceId: string;
  email: string;
  customData: {
    nexo_checkout_intent_id: string;
    nexo_plan_id: string;
    nexo_interval: string;
  };
  settings: {
    displayMode: "overlay";
    variant: "one-page";
    successUrl: string;
    allowLogout: false;
  };
};

export function buildCheckoutCustomData(input: {
  intentId: string;
  planId: string;
  interval: string;
}): CheckoutOpenPayload["customData"] {
  return {
    nexo_checkout_intent_id: input.intentId,
    nexo_plan_id: input.planId,
    nexo_interval: input.interval,
  };
}

export function authorizeAndPrepareCheckout(input: {
  authenticated: boolean;
  roles: AppRole[];
  profileAccountType?: string | null;
  email: string;
  request: CheckoutRequest;
  client?: ForbiddenClientCheckoutFields;
  env?: NodeJS.ProcessEnv;
  origin?: string;
}):
  | { ok: true; priceId: string; email: string; planId: string; interval: string; successUrl: string }
  | { ok: false; error: string; status: number } {
  const authz = authorizeCheckout({
    authenticated: input.authenticated,
    roles: input.roles,
    profileAccountType: input.profileAccountType,
    request: input.request,
    client: input.client,
    env: input.env,
  });
  if (!authz.ok) return authz;
  const email = input.email.trim();
  if (!email) {
    return { ok: false, error: "Verified email is required to start checkout.", status: 400 };
  }
  return {
    ok: true,
    priceId: authz.priceId,
    email,
    planId: authz.tierId,
    interval: authz.interval,
    successUrl: checkoutSuccessUrl(input.origin ?? getSiteUrl()),
  };
}
