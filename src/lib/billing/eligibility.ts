import type { AppRole } from "@/lib/auth/types";
import {
  getTier,
  isBillingInterval,
  isPaidTierId,
  isTierId,
  resolveApprovedPriceId,
  type BillingAccountType,
  type BillingInterval,
  type PaidTierId,
  type TierId,
} from "./plans";

export type CheckoutRequest = {
  planId: string;
  interval: string;
};

export type ForbiddenClientCheckoutFields = {
  priceId?: unknown;
  amount?: unknown;
  userId?: unknown;
  customerId?: unknown;
  accountType?: unknown;
};

export function billingAccountTypeFromRoles(
  roles: AppRole[],
  profileAccountType?: string | null
): BillingAccountType | null {
  if (roles.includes("label")) return "label";
  if (roles.includes("artist")) return "artist";
  if (profileAccountType === "label") return "label";
  if (profileAccountType === "artist") return "artist";
  return null;
}

export function planEligibleForAccountType(
  planId: string,
  accountType: BillingAccountType | null
): boolean {
  const tier = getTier(planId);
  if (!tier || !accountType) return false;
  return tier.accountType === accountType;
}

export function artistsCannotBuyLabelPlans(planId: string, accountType: BillingAccountType): boolean {
  return planEligibleForAccountType(planId, accountType);
}

export type AuthorizedCheckout =
  | {
      ok: true;
      tierId: PaidTierId;
      interval: BillingInterval;
      priceId: string;
      accountType: BillingAccountType;
    }
  | { ok: false; error: string; status: number };

function rejectClientOverrides(client: ForbiddenClientCheckoutFields | undefined): string | null {
  if (!client) return null;
  if (client.priceId !== undefined && client.priceId !== null && client.priceId !== "") {
    return "Client priceId is not accepted. The server resolves approved Price IDs.";
  }
  if (client.amount !== undefined && client.amount !== null && client.amount !== "") {
    return "Client amount is not accepted. Paddle is the authority for checkout amounts.";
  }
  if (client.userId !== undefined && client.userId !== null && client.userId !== "") {
    return "Client userId is not accepted.";
  }
  if (client.customerId !== undefined && client.customerId !== null && client.customerId !== "") {
    return "Client customerId is not accepted.";
  }
  if (client.accountType !== undefined && client.accountType !== null && client.accountType !== "") {
    return "Client accountType is not accepted.";
  }
  return null;
}

/**
 * Server-side checkout authorization.
 * Browser may send plan id + interval only.
 */
export function authorizeCheckout(input: {
  authenticated: boolean;
  roles: AppRole[];
  profileAccountType?: string | null;
  request: CheckoutRequest;
  client?: ForbiddenClientCheckoutFields;
  env?: NodeJS.ProcessEnv;
}): AuthorizedCheckout {
  const env = input.env ?? process.env;
  const overrideError = rejectClientOverrides(input.client);
  if (overrideError) return { ok: false, error: overrideError, status: 400 };

  if (!input.authenticated) {
    return { ok: false, error: "Sign in to start checkout.", status: 401 };
  }

  const accountType = billingAccountTypeFromRoles(input.roles, input.profileAccountType);
  if (!accountType) {
    return { ok: false, error: "Only artist and label accounts can subscribe.", status: 403 };
  }

  const { planId, interval } = input.request;
  if (!isTierId(planId)) {
    return { ok: false, error: "Unknown plan.", status: 400 };
  }
  if (planId === "artist_starter") {
    return { ok: false, error: "Artist Starter is free and does not use Paddle Checkout.", status: 400 };
  }
  if (!isPaidTierId(planId) || !isBillingInterval(interval)) {
    return { ok: false, error: "Invalid plan or billing interval.", status: 400 };
  }
  if (!planEligibleForAccountType(planId, accountType)) {
    return {
      ok: false,
      error:
        accountType === "artist"
          ? "Artist accounts cannot purchase Label plans."
          : "Label accounts cannot purchase Artist plans.",
      status: 403,
    };
  }

  const priceId = resolveApprovedPriceId(planId, interval, env);
  if (!priceId) {
    return {
      ok: false,
      error:
        "Paddle Sandbox catalog Price IDs are not configured yet. Checkout cannot start until catalog IDs are set.",
      status: 503,
    };
  }

  return {
    ok: true,
    tierId: planId,
    interval,
    priceId,
    accountType,
  };
}

export function selectFreeStarter(accountType: BillingAccountType): TierId | null {
  return accountType === "artist" ? "artist_starter" : null;
}
