import {
  BILLING_TRIAL_DAYS,
  CATALOG_USD_MINOR,
  PRICE_ID_ENV,
  catalogUsdDisplay,
  getTiers,
  type BillingInterval,
  type PaidTierId,
  type PlanConfigId,
  type TierId,
} from "./plans";
import { paddleClientConfig, readPaddleEnvironment } from "./env";

export type AdminPlanCatalogRow = {
  id: TierId;
  name: string;
  accountType: "artist" | "label";
  free: boolean;
  trialDays: number | null;
  amounts: { month: string | null; year: string | null };
  priceIdPresent: { month: boolean; year: boolean };
  envKeys: { month: PlanConfigId | null; year: PlanConfigId | null };
};

export type AdminBillingCatalog = {
  environment: "sandbox" | "production" | null;
  clientTokenPresent: boolean;
  catalogReady: boolean;
  message: string | null;
  rows: AdminPlanCatalogRow[];
};

function paidEnv(tierId: PaidTierId, interval: BillingInterval): PlanConfigId {
  return `${tierId}_${interval === "month" ? "monthly" : "annual"}` as PlanConfigId;
}

/**
 * Admin finance/billing plan catalog.
 * Shows Starter/Pro amounts + trials from server config and whether price-id
 * env vars are set. Never returns secret values or raw price IDs.
 */
export function adminBillingCatalog(env: NodeJS.ProcessEnv = process.env): AdminBillingCatalog {
  const cfg = paddleClientConfig(env);
  const environment = readPaddleEnvironment(env);
  const tiers = getTiers(env);
  const rows: AdminPlanCatalogRow[] = tiers.map((t) => {
    if (t.free) {
      return {
        id: t.id,
        name: t.name,
        accountType: t.accountType,
        free: true,
        trialDays: null,
        amounts: { month: "Free", year: null },
        priceIdPresent: { month: false, year: false },
        envKeys: { month: null, year: null },
      };
    }
    const paid = t.id as PaidTierId;
    const monthKey = paidEnv(paid, "month");
    const yearKey = paidEnv(paid, "year");
    return {
      id: t.id,
      name: t.name,
      accountType: t.accountType,
      free: false,
      trialDays: t.trialDays ?? BILLING_TRIAL_DAYS,
      amounts: {
        month: catalogUsdDisplay(paid, "month"),
        year: catalogUsdDisplay(paid, "year"),
      },
      priceIdPresent: {
        month: Boolean(env[PRICE_ID_ENV[monthKey]]?.trim()),
        year: Boolean(env[PRICE_ID_ENV[yearKey]]?.trim()),
      },
      envKeys: { month: monthKey, year: yearKey },
    };
  });

  let message: string | null = null;
  if (!cfg.clientTokenPresent) {
    message = "Paddle.js client token is not set. Checkout stays unavailable.";
  } else if (!environment) {
    message = "PADDLE_ENVIRONMENT is not set. Billing cannot default to sandbox.";
  }

  const catalogReady = rows
    .filter((r) => !r.free)
    .every((r) => r.priceIdPresent.month && r.priceIdPresent.year);

  return {
    environment,
    clientTokenPresent: cfg.clientTokenPresent,
    catalogReady,
    message,
    rows,
  };
}

export { CATALOG_USD_MINOR };
