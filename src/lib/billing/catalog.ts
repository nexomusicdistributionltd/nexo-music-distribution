import {
  catalogConfigured,
  catalogUsdDisplayMap,
  getTiers,
  paidPriceIdsForPreview,
  type BillingAccountType,
  type BillingInterval,
  type PaidTierId,
  type PriceIdPair,
  type Tier,
} from "./plans";
import { paddleClientConfig, readPaddleEnvironment } from "./env";

export type PublicCatalogPrice = {
  tierId: PaidTierId;
  priceId: string;
};

export type PublicBillingCatalog = {
  environment: "sandbox" | "production" | null;
  clientTokenPresent: boolean;
  catalogReady: boolean;
  message: string | null;
  tiers: Array<
    Pick<Tier, "id" | "accountType" | "name" | "description" | "features" | "free" | "trialDays">
  >;
  prices: {
    artist: { month: PublicCatalogPrice[]; year: PublicCatalogPrice[] };
    label: { month: PublicCatalogPrice[]; year: PublicCatalogPrice[] };
  };
  /** Canonical USD list prices. Used when PricePreview cannot run. */
  displayUsd: Record<PaidTierId, PriceIdPair>;
};

function pricesFor(accountType: BillingAccountType, env: NodeJS.ProcessEnv) {
  return {
    month: paidPriceIdsForPreview(accountType, "month", env),
    year: paidPriceIdsForPreview(accountType, "year", env),
  };
}

export function publicBillingCatalog(env: NodeJS.ProcessEnv = process.env): PublicBillingCatalog {
  const cfg = paddleClientConfig(env);
  const ready = catalogConfigured(env) && cfg.clientTokenPresent && Boolean(cfg.environment);
  let message: string | null = null;
  if (!cfg.environment) {
    message = "PADDLE_ENVIRONMENT is not set. Billing cannot default to sandbox.";
  } else if (!cfg.clientTokenPresent) {
    message = "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is not set. Localized prices cannot load from Paddle.js.";
  } else if (!catalogConfigured(env)) {
    message =
      "Paddle Sandbox Product/Price IDs are not configured yet. USD list prices still display; checkout stays unavailable until the catalog exists.";
  }

  return {
    environment: readPaddleEnvironment(env),
    clientTokenPresent: cfg.clientTokenPresent,
    catalogReady: ready,
    message,
    tiers: getTiers(env).map((t) => ({
      id: t.id,
      accountType: t.accountType,
      name: t.name,
      description: t.description,
      features: t.features,
      free: t.free,
      trialDays: t.trialDays,
    })),
    prices: {
      artist: pricesFor("artist", env),
      label: pricesFor("label", env),
    },
    displayUsd: catalogUsdDisplayMap(),
  };
}

export function previewItemsFor(
  accountType: BillingAccountType,
  interval: BillingInterval,
  catalog: PublicBillingCatalog
): { priceId: string; quantity: number }[] {
  return catalog.prices[accountType][interval === "month" ? "month" : "year"].map((p) => ({
    priceId: p.priceId,
    quantity: 1,
  }));
}
