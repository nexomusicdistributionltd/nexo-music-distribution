/**
 * Canonical Nexo subscription catalog.
 * Paddle is the authority for checkout amounts. These catalog values
 * document the intended Sandbox products and approved country unit-price
 * overrides. They are never used to grant entitlements. /pricing may show
 * configured list prices only when PricePreview cannot run.
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

export type OverrideCountryCode = "GB" | "IE" | "AU";
export type OverrideCurrencyCode = "GBP" | "EUR" | "AUD";

export type ApprovedOverrideMarket = {
  countryCode: OverrideCountryCode;
  currencyCode: OverrideCurrencyCode;
};

/**
 * Approved Paddle country unit-price override markets.
 * EUR applies to Ireland (IE) only — not the full Eurozone.
 */
export const APPROVED_OVERRIDE_MARKETS: readonly ApprovedOverrideMarket[] = [
  { countryCode: "GB", currencyCode: "GBP" },
  { countryCode: "IE", currencyCode: "EUR" },
  { countryCode: "AU", currencyCode: "AUD" },
] as const;

export const APPROVED_OVERRIDE_CURRENCIES: readonly OverrideCurrencyCode[] = ["GBP", "EUR", "AUD"];

/** Amounts are approved. Do not POST these to Paddle until the Sandbox API key is provided. */
export const COUNTRY_PRICE_OVERRIDES_APPROVED = true;
export const COUNTRY_PRICE_OVERRIDES_CREATED_IN_PADDLE = false;

/** @deprecated Use APPROVED_OVERRIDE_CURRENCIES. */
export const PENDING_OVERRIDE_CURRENCIES = APPROVED_OVERRIDE_CURRENCIES;

/**
 * Approved Paddle `unit_price.amount` minor units by country.
 * These are explicit catalog amounts, not frontend FX conversions.
 */
export const CATALOG_COUNTRY_OVERRIDE_MINOR: Record<
  PaidTierId,
  Record<BillingInterval, Record<OverrideCountryCode, string>>
> = {
  artist_pro: {
    month: { GB: "799", IE: "949", AU: "1499" },
    year: { GB: "7900", IE: "9400", AU: "14900" },
  },
  label_starter: {
    month: { GB: "1599", IE: "1899", AU: "2999" },
    year: { GB: "15900", IE: "18900", AU: "29900" },
  },
  label_pro: {
    month: { GB: "3999", IE: "4799", AU: "7499" },
    year: { GB: "39900", IE: "47900", AU: "74900" },
  },
};

export type PaddleUnitPriceOverride = {
  countryCodes: [OverrideCountryCode];
  unitPrice: { amount: string; currencyCode: OverrideCurrencyCode };
};

export function currencyForOverrideCountry(country: OverrideCountryCode): OverrideCurrencyCode {
  const market = APPROVED_OVERRIDE_MARKETS.find((m) => m.countryCode === country);
  if (!market) throw new Error(`Unknown override country ${country}`);
  return market.currencyCode;
}

export function isOverrideCountryCode(value: string | null | undefined): value is OverrideCountryCode {
  return value === "GB" || value === "IE" || value === "AU";
}

/**
 * Paddle Billing price.unitPriceOverrides payload for later Sandbox catalog creation.
 * Do not send this to the Paddle API until the Sandbox key is available.
 */
export function paddleUnitPriceOverridesFor(
  tierId: PaidTierId,
  interval: BillingInterval
): PaddleUnitPriceOverride[] {
  const amounts = CATALOG_COUNTRY_OVERRIDE_MINOR[tierId][interval];
  return APPROVED_OVERRIDE_MARKETS.map((market) => ({
    countryCodes: [market.countryCode],
    unitPrice: {
      amount: amounts[market.countryCode],
      currencyCode: market.currencyCode,
    },
  }));
}

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

function formatCatalogMinorDisplay(minorUnits: string, prefix: string): string {
  if (!/^\d+$/.test(minorUnits)) {
    throw new Error(`Invalid catalog minor units: ${minorUnits}`);
  }
  const n = Number.parseInt(minorUnits, 10);
  const major = n / 100;
  const body = Number.isInteger(major) ? String(major) : major.toFixed(2);
  return `${prefix}${body}`;
}

export function formatOverrideDisplay(minorUnits: string, currency: OverrideCurrencyCode): string {
  if (currency === "GBP") return formatCatalogMinorDisplay(minorUnits, "£");
  if (currency === "EUR") return formatCatalogMinorDisplay(minorUnits, "€");
  return formatCatalogMinorDisplay(minorUnits, "A$");
}

export function catalogOverrideDisplay(
  tierId: PaidTierId,
  interval: BillingInterval,
  country: OverrideCountryCode
): string {
  const minor = CATALOG_COUNTRY_OVERRIDE_MINOR[tierId][interval][country];
  return formatOverrideDisplay(minor, currencyForOverrideCountry(country));
}

export function catalogOverrideDisplayMap(): Record<
  OverrideCountryCode,
  Record<PaidTierId, PriceIdPair>
> {
  const paid: PaidTierId[] = ["artist_pro", "label_starter", "label_pro"];
  const countries: OverrideCountryCode[] = ["GB", "IE", "AU"];
  const out = {} as Record<OverrideCountryCode, Record<PaidTierId, PriceIdPair>>;
  for (const country of countries) {
    out[country] = {
      artist_pro: { month: "", year: "" },
      label_starter: { month: "", year: "" },
      label_pro: { month: "", year: "" },
    };
    for (const tierId of paid) {
      out[country][tierId] = {
        month: catalogOverrideDisplay(tierId, "month", country),
        year: catalogOverrideDisplay(tierId, "year", country),
      };
    }
  }
  return out;
}

export function configuredListPrice(input: {
  tierId: PaidTierId;
  interval: BillingInterval;
  country: string | null;
}): string {
  if (isOverrideCountryCode(input.country)) {
    return catalogOverrideDisplay(input.tierId, input.interval, input.country);
  }
  return catalogUsdDisplay(input.tierId, input.interval);
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
