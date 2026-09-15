/**
 * Canonical Nexo subscription catalog.
 * Paddle is the authority for checkout amounts. These USD catalog values
 * document the intended Sandbox products; they are never used to format
 * prices on /pricing or to grant entitlements.
 */

export type BillingAccountType = "artist" | "label";
export type BillingInterval = "month" | "year";

export type TierId = "artist_starter" | "artist_pro" | "label_starter" | "label_pro";

export type PaidTierId = Exclude<TierId, "artist_starter">;

export type PlanConfigId =
  | "artist_pro_monthly"
  | "artist_pro_annual"
  | "label_starter_monthly"
  | "label_starter_annual"
  | "label_pro_monthly"
  | "label_pro_annual";

export type PriceIdPair = {
  month: string;
  year: string;
};

export type Tier = {
  id: TierId;
  accountType: BillingAccountType;
  name: string;
  description: string;
  features: string[];
  /** Present only for paid tiers. Resolved from env; empty until Sandbox catalog exists. */
  priceId?: PriceIdPair;
  /** Paid catalog only. 7-day trial on both intervals. */
  trialDays?: number;
  /** True when this tier has no Paddle subscription. */
  free?: boolean;
};

/** Intended USD minor-unit amounts for Sandbox catalog creation. Not for UI. */
export const CATALOG_USD_MINOR: Record<
  PaidTierId,
  { month: "999" | "1999" | "4999"; year: "9900" | "19900" | "49900" }
> = {
  artist_pro: { month: "999", year: "9900" },
  label_starter: { month: "1999", year: "19900" },
  label_pro: { month: "4999", year: "49900" },
};

export const BILLING_TRIAL_DAYS = 7;

export const PRICE_ID_ENV: Record<PlanConfigId, string> = {
  artist_pro_monthly: "PADDLE_PRICE_ARTIST_PRO_MONTHLY",
  artist_pro_annual: "PADDLE_PRICE_ARTIST_PRO_ANNUAL",
  label_starter_monthly: "PADDLE_PRICE_LABEL_STARTER_MONTHLY",
  label_starter_annual: "PADDLE_PRICE_LABEL_STARTER_ANNUAL",
  label_pro_monthly: "PADDLE_PRICE_LABEL_PRO_MONTHLY",
  label_pro_annual: "PADDLE_PRICE_LABEL_PRO_ANNUAL",
};

export const PRODUCT_ID_ENV: Record<PaidTierId, string> = {
  artist_pro: "PADDLE_PRODUCT_ARTIST_PRO",
  label_starter: "PADDLE_PRODUCT_LABEL_STARTER",
  label_pro: "PADDLE_PRODUCT_LABEL_PRO",
};

/**
 * Country unit-price overrides are structured for a later catalog pass.
 * Do NOT create GBP/EUR/AUD overrides in Paddle until amounts are approved.
 */
export const COUNTRY_PRICE_OVERRIDES_APPROVED = false;
export const PENDING_OVERRIDE_CURRENCIES = ["GBP", "EUR", "AUD"] as const;

const ARTIST_STARTER_FEATURES = [
  "Release delivery to Nexo’s distribution workflow",
  "Artist dashboard, catalog, and royalty ledger access",
  "Quality-control submission path",
  "Support inbox",
];

const ARTIST_PRO_FEATURES = [
  "Everything in Artist Starter",
  "Artist Pro subscription for ongoing distribution operations",
  "Priority queue handling as capacity allows",
  "7-day free trial on monthly and annual billing",
];

const LABEL_STARTER_FEATURES = [
  "Multi-artist roster and label catalog tools",
  "Label royalty statements and payout workflows",
  "Shared QC standards for roster releases",
  "7-day free trial on monthly and annual billing",
];

const LABEL_PRO_FEATURES = [
  "Everything in Label Starter",
  "Higher-volume label operations",
  "Priority operational handling as capacity allows",
  "7-day free trial on monthly and annual billing",
];

/** Configured USD display for /pricing when Paddle PricePreview is unavailable. */
export function formatCatalogUsdDisplay(minorUnits: string): string {
  if (!/^\d+$/.test(minorUnits)) {
    throw new Error(`Invalid catalog USD minor units: ${minorUnits}`);
  }
  const n = Number.parseInt(minorUnits, 10);
  const dollars = n / 100;
  if (Number.isInteger(dollars)) return `$${dollars}`;
  return `$${dollars.toFixed(2)}`;
}

export function catalogUsdDisplay(tierId: PaidTierId, interval: BillingInterval): string {
  const key = interval === "month" ? "month" : "year";
  return formatCatalogUsdDisplay(CATALOG_USD_MINOR[tierId][key]);
}

export function catalogUsdDisplayMap(): Record<PaidTierId, PriceIdPair> {
  return {
    artist_pro: {
      month: catalogUsdDisplay("artist_pro", "month"),
      year: catalogUsdDisplay("artist_pro", "year"),
    },
    label_starter: {
      month: catalogUsdDisplay("label_starter", "month"),
      year: catalogUsdDisplay("label_starter", "year"),
    },
    label_pro: {
      month: catalogUsdDisplay("label_pro", "month"),
      year: catalogUsdDisplay("label_pro", "year"),
    },
  };
}

export function readPriceIdsFromEnv(
  env: NodeJS.ProcessEnv = process.env
): Record<PaidTierId, PriceIdPair> {
  const get = (key: PlanConfigId) => env[PRICE_ID_ENV[key]]?.trim() ?? "";
  return {
    artist_pro: { month: get("artist_pro_monthly"), year: get("artist_pro_annual") },
    label_starter: { month: get("label_starter_monthly"), year: get("label_starter_annual") },
    label_pro: { month: get("label_pro_monthly"), year: get("label_pro_annual") },
  };
}

export function readProductIdsFromEnv(
  env: NodeJS.ProcessEnv = process.env
): Record<PaidTierId, string> {
  return {
    artist_pro: env[PRODUCT_ID_ENV.artist_pro]?.trim() ?? "",
    label_starter: env[PRODUCT_ID_ENV.label_starter]?.trim() ?? "",
    label_pro: env[PRODUCT_ID_ENV.label_pro]?.trim() ?? "",
  };
}

export function getTiers(env: NodeJS.ProcessEnv = process.env): Tier[] {
  const prices = readPriceIdsFromEnv(env);
  return [
    {
      id: "artist_starter",
      accountType: "artist",
      name: "Artist Starter",
      description: "Free artist access. No Paddle subscription.",
      features: ARTIST_STARTER_FEATURES,
      free: true,
    },
    {
      id: "artist_pro",
      accountType: "artist",
      name: "Artist Pro",
      description: "Paid artist distribution subscription with a 7-day trial.",
      features: ARTIST_PRO_FEATURES,
      priceId: prices.artist_pro,
      trialDays: BILLING_TRIAL_DAYS,
    },
    {
      id: "label_starter",
      accountType: "label",
      name: "Label Starter",
      description: "Paid label operations subscription with a 7-day trial.",
      features: LABEL_STARTER_FEATURES,
      priceId: prices.label_starter,
      trialDays: BILLING_TRIAL_DAYS,
    },
    {
      id: "label_pro",
      accountType: "label",
      name: "Label Pro",
      description: "Paid high-volume label subscription with a 7-day trial.",
      features: LABEL_PRO_FEATURES,
      priceId: prices.label_pro,
      trialDays: BILLING_TRIAL_DAYS,
    },
  ];
}

export function getTier(id: string, env: NodeJS.ProcessEnv = process.env): Tier | null {
  return getTiers(env).find((t) => t.id === id) ?? null;
}

export function isTierId(value: string): value is TierId {
  return (
    value === "artist_starter" ||
    value === "artist_pro" ||
    value === "label_starter" ||
    value === "label_pro"
  );
}

export function isPaidTierId(value: string): value is PaidTierId {
  return value === "artist_pro" || value === "label_starter" || value === "label_pro";
}

export function isBillingInterval(value: string): value is BillingInterval {
  return value === "month" || value === "year";
}

export function planConfigId(tierId: PaidTierId, interval: BillingInterval): PlanConfigId {
  return `${tierId}_${interval === "month" ? "monthly" : "annual"}` as PlanConfigId;
}

export function parsePlanConfigId(
  id: string
): { tierId: PaidTierId; interval: BillingInterval } | null {
  const match = /^(artist_pro|label_starter|label_pro)_(monthly|annual)$/.exec(id);
  if (!match) return null;
  return {
    tierId: match[1] as PaidTierId,
    interval: match[2] === "monthly" ? "month" : "year",
  };
}

export function resolveApprovedPriceId(
  tierId: string,
  interval: string,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  if (!isPaidTierId(tierId) || !isBillingInterval(interval)) return null;
  const pair = readPriceIdsFromEnv(env)[tierId];
  const id = interval === "month" ? pair.month : pair.year;
  return id || null;
}

/** Map a Paddle price ID (from webhooks) back to an internal plan. Never trust client price IDs. */
export function planFromApprovedPriceId(
  paddlePriceId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env
): { tierId: PaidTierId; interval: BillingInterval; configId: PlanConfigId } | null {
  if (!paddlePriceId?.trim()) return null;
  const prices = readPriceIdsFromEnv(env);
  for (const tierId of ["artist_pro", "label_starter", "label_pro"] as const) {
    if (prices[tierId].month && prices[tierId].month === paddlePriceId) {
      return { tierId, interval: "month", configId: planConfigId(tierId, "month") };
    }
    if (prices[tierId].year && prices[tierId].year === paddlePriceId) {
      return { tierId, interval: "year", configId: planConfigId(tierId, "year") };
    }
  }
  return null;
}

export function paidPriceIdsForPreview(
  accountType: BillingAccountType,
  interval: BillingInterval,
  env: NodeJS.ProcessEnv = process.env
): { tierId: PaidTierId; priceId: string }[] {
  const tiers = getTiers(env).filter(
    (t) => t.accountType === accountType && t.priceId && !t.free
  );
  const out: { tierId: PaidTierId; priceId: string }[] = [];
  for (const tier of tiers) {
    const priceId = interval === "month" ? tier.priceId?.month : tier.priceId?.year;
    if (priceId && isPaidTierId(tier.id)) out.push({ tierId: tier.id, priceId });
  }
  return out;
}

export function catalogConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const prices = readPriceIdsFromEnv(env);
  return Object.values(prices).every((pair) => pair.month.length > 0 && pair.year.length > 0);
}

/** @internal used by tests — env names only */
export function catalogEnvNames(): string[] {
  return [...Object.values(PRICE_ID_ENV), ...Object.values(PRODUCT_ID_ENV)];
}
