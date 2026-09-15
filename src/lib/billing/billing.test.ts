import { describe, expect, it, afterEach } from "vitest";
import {
  CATALOG_USD_MINOR,
  PRICE_ID_ENV,
  catalogEnvNames,
  catalogUsdDisplay,
  configuredListPrice,
  formatCatalogUsdDisplay,
  getTiers,
  paddleUnitPriceOverridesFor,
  planConfigId,
  planFromApprovedPriceId,
  resolveApprovedPriceId,
  CATALOG_COUNTRY_OVERRIDE_MINOR,
  COUNTRY_PRICE_OVERRIDES_APPROVED,
  COUNTRY_PRICE_OVERRIDES_CREATED_IN_PADDLE,
} from "./plans";
import { authorizeCheckout, planEligibleForAccountType, selectFreeStarter } from "./eligibility";
import { requirePaddleEnvironment, PaddleEnvError, assertNoSecretInPublicEnv } from "./env";
import { getBillingEntitlements, subscriptionGrantsPaidAccess } from "./entitlements";
import { parseTrustedCountryCode, countryFromTrustedHeaders, paddleAddressForPreview } from "./country";
import { authorizeCustomerPortal } from "./portal";
import { authorizeAndPrepareCheckout } from "./checkout";
import {
  billingCheckoutReturnPath,
  loginHrefForPlan,
  registerHrefForPlan,
  parseBillingSelection,
} from "./auth-return";
import {
  HANDLED_PADDLE_EVENTS,
  isHandledPaddleEvent,
  mapPaddleSubscription,
  shouldApplyOccurredAt,
} from "./webhook-map";
import { publicBillingCatalog } from "./catalog";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const paidEnv = {
  PADDLE_PRICE_ARTIST_PRO_MONTHLY: "pri_artist_pro_m",
  PADDLE_PRICE_ARTIST_PRO_ANNUAL: "pri_artist_pro_y",
  PADDLE_PRICE_LABEL_STARTER_MONTHLY: "pri_label_starter_m",
  PADDLE_PRICE_LABEL_STARTER_ANNUAL: "pri_label_starter_y",
  PADDLE_PRICE_LABEL_PRO_MONTHLY: "pri_label_pro_m",
  PADDLE_PRICE_LABEL_PRO_ANNUAL: "pri_label_pro_y",
} as NodeJS.ProcessEnv;

describe("canonical plan mapping", () => {
  it("maps interval config ids to price env names", () => {
    expect(planConfigId("artist_pro", "month")).toBe("artist_pro_monthly");
    expect(PRICE_ID_ENV.artist_pro_monthly).toBe("PADDLE_PRICE_ARTIST_PRO_MONTHLY");
    expect(CATALOG_USD_MINOR.artist_pro).toEqual({ month: "999", year: "9900" });
    expect(CATALOG_USD_MINOR.label_starter).toEqual({ month: "1999", year: "19900" });
    expect(CATALOG_USD_MINOR.label_pro).toEqual({ month: "4999", year: "49900" });
    expect(formatCatalogUsdDisplay("999")).toBe("$9.99");
    expect(formatCatalogUsdDisplay("9900")).toBe("$99");
    expect(catalogUsdDisplay("label_starter", "month")).toBe("$19.99");
    expect(catalogUsdDisplay("label_pro", "year")).toBe("$499");
  });

  it("resolves approved price IDs only from env", () => {
    expect(resolveApprovedPriceId("artist_pro", "month", paidEnv)).toBe("pri_artist_pro_m");
    expect(resolveApprovedPriceId("artist_pro", "month", {})).toBeNull();
    expect(planFromApprovedPriceId("pri_label_pro_y", paidEnv)).toEqual({
      tierId: "label_pro",
      interval: "year",
      configId: "label_pro_annual",
    });
    expect(planFromApprovedPriceId("pri_forged", paidEnv)).toBeNull();
  });

  it("records approved GB/IE/AU Paddle unit-price overrides without creating catalog", () => {
    expect(COUNTRY_PRICE_OVERRIDES_APPROVED).toBe(true);
    expect(COUNTRY_PRICE_OVERRIDES_CREATED_IN_PADDLE).toBe(false);
    expect(CATALOG_COUNTRY_OVERRIDE_MINOR.artist_pro.month).toEqual({
      GB: "799",
      IE: "949",
      AU: "1499",
    });
    expect(CATALOG_COUNTRY_OVERRIDE_MINOR.artist_pro.year).toEqual({
      GB: "7900",
      IE: "9400",
      AU: "14900",
    });
    expect(CATALOG_COUNTRY_OVERRIDE_MINOR.label_starter.month).toEqual({
      GB: "1599",
      IE: "1899",
      AU: "2999",
    });
    expect(CATALOG_COUNTRY_OVERRIDE_MINOR.label_starter.year).toEqual({
      GB: "15900",
      IE: "18900",
      AU: "29900",
    });
    expect(CATALOG_COUNTRY_OVERRIDE_MINOR.label_pro.month).toEqual({
      GB: "3999",
      IE: "4799",
      AU: "7499",
    });
    expect(CATALOG_COUNTRY_OVERRIDE_MINOR.label_pro.year).toEqual({
      GB: "39900",
      IE: "47900",
      AU: "74900",
    });
    expect(configuredListPrice({ tierId: "artist_pro", interval: "month", country: "GB" })).toBe(
      "£7.99"
    );
    expect(configuredListPrice({ tierId: "artist_pro", interval: "year", country: "IE" })).toBe("€94");
    expect(configuredListPrice({ tierId: "label_pro", interval: "month", country: "AU" })).toBe(
      "A$74.99"
    );
    expect(configuredListPrice({ tierId: "artist_pro", interval: "month", country: null })).toBe(
      "$9.99"
    );
    expect(configuredListPrice({ tierId: "artist_pro", interval: "month", country: "DE" })).toBe(
      "$9.99"
    );
    const gb = paddleUnitPriceOverridesFor("artist_pro", "month");
    expect(gb).toEqual([
      { countryCodes: ["GB"], unitPrice: { amount: "799", currencyCode: "GBP" } },
      { countryCodes: ["IE"], unitPrice: { amount: "949", currencyCode: "EUR" } },
      { countryCodes: ["AU"], unitPrice: { amount: "1499", currencyCode: "AUD" } },
    ]);
    expect(gb.find((o) => o.countryCodes[0] === "DE")).toBeUndefined();
  });

  it("keeps artist starter free with no price IDs", () => {
    const starter = getTiers(paidEnv).find((t) => t.id === "artist_starter");
    expect(starter?.free).toBe(true);
    expect(starter?.priceId).toBeUndefined();
    expect(selectFreeStarter("artist")).toBe("artist_starter");
    expect(selectFreeStarter("label")).toBeNull();
  });
});

describe("account-type eligibility", () => {
  it("blocks artists from label plans and labels from artist plans", () => {
    expect(planEligibleForAccountType("artist_pro", "artist")).toBe(true);
    expect(planEligibleForAccountType("label_pro", "artist")).toBe(false);
    expect(planEligibleForAccountType("artist_pro", "label")).toBe(false);
    expect(planEligibleForAccountType("label_starter", "label")).toBe(true);
  });
});

describe("checkout authorization", () => {
  it("requires authentication", () => {
    const result = authorizeCheckout({
      authenticated: false,
      roles: ["artist"],
      request: { planId: "artist_pro", interval: "month" },
      env: paidEnv,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("rejects free starter checkout", () => {
    const result = authorizeCheckout({
      authenticated: true,
      roles: ["artist"],
      request: { planId: "artist_starter", interval: "month" },
      env: paidEnv,
    });
    expect(result.ok).toBe(false);
  });

  it("never trusts client priceId, amount, userId, customerId, or accountType", () => {
    const base = {
      authenticated: true,
      roles: ["artist"] as const,
      request: { planId: "artist_pro", interval: "month" as const },
      env: paidEnv,
    };
    expect(authorizeCheckout({ ...base, client: { priceId: "pri_forged" } }).ok).toBe(false);
    expect(authorizeCheckout({ ...base, client: { amount: "1" } }).ok).toBe(false);
    expect(authorizeCheckout({ ...base, client: { userId: "someone-else" } }).ok).toBe(false);
    expect(authorizeCheckout({ ...base, client: { customerId: "ctm_forged" } }).ok).toBe(false);
    expect(authorizeCheckout({ ...base, client: { accountType: "label" } }).ok).toBe(false);
  });

  it("resolves server price ID for eligible artist", () => {
    const result = authorizeCheckout({
      authenticated: true,
      roles: ["artist"],
      request: { planId: "artist_pro", interval: "year" },
      env: paidEnv,
    });
    expect(result).toMatchObject({ ok: true, priceId: "pri_artist_pro_y", tierId: "artist_pro" });
  });

  it("returns 503 when catalog price IDs are empty", () => {
    const result = authorizeCheckout({
      authenticated: true,
      roles: ["label"],
      request: { planId: "label_pro", interval: "month" },
      env: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(503);
  });
});

describe("env fail-loud", () => {
  const original = process.env.PADDLE_ENVIRONMENT;

  afterEach(() => {
    if (original === undefined) delete process.env.PADDLE_ENVIRONMENT;
    else process.env.PADDLE_ENVIRONMENT = original;
  });

  it("throws when PADDLE_ENVIRONMENT is unset — no silent sandbox default", () => {
    delete process.env.PADDLE_ENVIRONMENT;
    expect(() => requirePaddleEnvironment({})).toThrow(PaddleEnvError);
    expect(() => requirePaddleEnvironment({})).toThrow(/No silent default/);
  });

  it("rejects NEXT_PUBLIC paddle secrets", () => {
    expect(() =>
      assertNoSecretInPublicEnv({ NEXT_PUBLIC_PADDLE_API_KEY: "pdl_live" } as NodeJS.ProcessEnv)
    ).toThrow(/must never be set/);
  });
});

describe("entitlement states", () => {
  const base = {
    userId: "u1",
    accountType: "artist" as const,
    planId: "artist_pro" as const,
    interval: "month" as const,
    trialEndsAt: null,
    currentPeriodStartsAt: "2026-01-01T00:00:00Z",
    currentPeriodEndsAt: "2026-02-01T00:00:00Z",
    scheduledChangeAction: null,
    scheduledChangeEffectiveAt: null,
    canceledAt: null,
    pausedAt: null,
  };

  it("grants paid access for active and trialing", () => {
    expect(subscriptionGrantsPaidAccess({ ...base, status: "active" })).toBe(true);
    expect(subscriptionGrantsPaidAccess({ ...base, status: "trialing" })).toBe(true);
  });

  it("keeps access while cancel is scheduled and status remains active", () => {
    expect(
      subscriptionGrantsPaidAccess({
        ...base,
        status: "active",
        scheduledChangeAction: "cancel",
        scheduledChangeEffectiveAt: "2099-01-01T00:00:00Z",
      })
    ).toBe(true);
  });

  it("denies paused and past_due", () => {
    expect(subscriptionGrantsPaidAccess({ ...base, status: "paused" })).toBe(false);
    expect(subscriptionGrantsPaidAccess({ ...base, status: "past_due" })).toBe(false);
    expect(subscriptionGrantsPaidAccess({ ...base, status: "canceled" })).toBe(false);
  });

  it("grandfathers artists without a subscription onto starter without locking features", () => {
    const e = getBillingEntitlements({ accountType: "artist", subscription: null });
    expect(e.planId).toBe("artist_starter");
    expect(e.paidAccess).toBe(false);
    expect(e.grandfathered).toBe(true);
  });

  it("grandfathers labels without a subscription so existing features stay available", () => {
    const e = getBillingEntitlements({ accountType: "label", subscription: null });
    expect(e.paidAccess).toBe(false);
    expect(e.grandfathered).toBe(true);
    expect(e.planId).toBeNull();
  });
});

describe("country detection", () => {
  it("accepts ISO codes from trusted headers and rejects placeholders", () => {
    expect(parseTrustedCountryCode("gb")).toBe("GB");
    expect(parseTrustedCountryCode("OTHERS")).toBeNull();
    expect(parseTrustedCountryCode("UNKNOWN")).toBeNull();
    expect(parseTrustedCountryCode("NONE")).toBeNull();
    expect(parseTrustedCountryCode("XX")).toBeNull();
    const headers = new Headers({ "cf-ipcountry": "US" });
    expect(countryFromTrustedHeaders(headers)).toBe("US");
    expect(paddleAddressForPreview(null)).toBeUndefined();
    expect(paddleAddressForPreview("OTHERS")).toBeUndefined();
  });
});

describe("customer portal authz", () => {
  it("rejects anonymous users and client-supplied customer ids", () => {
    expect(authorizeCustomerPortal({ authenticated: false, roles: ["artist"] }).ok).toBe(false);
    expect(
      authorizeCustomerPortal({
        authenticated: true,
        roles: ["artist"],
        requestedCustomerId: "ctm_from_browser",
      }).ok
    ).toBe(false);
    expect(authorizeCustomerPortal({ authenticated: true, roles: ["artist"] }).ok).toBe(true);
  });
});

describe("auth redirects preserve selected plan", () => {
  it("builds login/register return paths with plan and interval", () => {
    expect(billingCheckoutReturnPath({ planId: "artist_pro", interval: "month" })).toContain(
      "plan=artist_pro"
    );
    expect(loginHrefForPlan({ planId: "label_pro", interval: "year" })).toContain("/login?");
    expect(registerHrefForPlan({ planId: "label_starter", interval: "month", accountType: "label" })).toContain(
      "type=label"
    );
    expect(parseBillingSelection({ plan: "artist_pro", interval: "year" })).toEqual({
      planId: "artist_pro",
      interval: "year",
    });
  });
});

describe("webhook mapping", () => {
  it("uses current Paddle Billing event names", () => {
    expect(HANDLED_PADDLE_EVENTS).toContain("subscription.created");
    expect(HANDLED_PADDLE_EVENTS).toContain("subscription.trialing");
    expect(HANDLED_PADDLE_EVENTS).toContain("transaction.payment_failed");
    expect(isHandledPaddleEvent("subscription.created")).toBe(true);
    expect(isHandledPaddleEvent("subscription.payment_succeeded")).toBe(false);
  });

  it("is out-of-order safe", () => {
    expect(shouldApplyOccurredAt("2026-02-01T00:00:00Z", "2026-01-01T00:00:00Z")).toBe(true);
    expect(shouldApplyOccurredAt("2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z")).toBe(false);
  });

  it("maps subscription payload to plan via approved price IDs", () => {
    const mapped = mapPaddleSubscription(
      {
        id: "sub_01aaaaaaaaaaaaaaaaaaaaaaaa",
        customerId: "ctm_01bbbbbbbbbbbbbbbbbbbbbbbb",
        status: "trialing",
        billingCycle: { interval: "month", frequency: 1 },
        items: [{ price: { id: "pri_artist_pro_m" }, product: { id: "pro_x" } }],
      },
      "2026-01-01T00:00:00Z",
      paidEnv
    );
    expect(mapped?.planId).toBe("artist_pro");
    expect(mapped?.interval).toBe("month");
  });
});

describe("checkout prepare does not grant entitlements", () => {
  it("returns overlay settings and never a paid flag", () => {
    const prepared = authorizeAndPrepareCheckout({
      authenticated: true,
      roles: ["artist"],
      email: "a@example.com",
      request: { planId: "artist_pro", interval: "month" },
      env: paidEnv,
      origin: "https://nexomusicdistribution.com",
    });
    expect(prepared.ok).toBe(true);
    if (prepared.ok) {
      expect(prepared.successUrl).toContain("/billing/success");
      expect(JSON.stringify(prepared)).not.toMatch(/paidAccess":true/);
    }
  });
});

describe("RLS expectations", () => {
  it("migration selects own rows, staff read, and no client writes that grant paid", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20260915800001_paddle_billing.sql"),
      "utf8"
    );
    expect(sql).toContain("billing_subscriptions_select_own");
    expect(sql).toContain("is_admin_portal_staff");
    expect(sql).toContain("billing_subscriptions_no_client_write");
    expect(sql).toContain("using (false)");
    expect(sql).toContain("user_id = auth.uid()");
    const harden = readFileSync(
      join(process.cwd(), "supabase/migrations/20260915800002_paddle_billing_hardening.sql"),
      "utf8"
    );
    expect(harden).toContain("revoke insert, update, delete on public.billing_subscriptions");
  });
});

describe("webhook ingress order", () => {
  it("verifies signature before any DB mutation", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/webhooks/paddle/route.ts"), "utf8");
    expect(route.indexOf("unmarshalPaddleWebhook")).toBeGreaterThan(-1);
    expect(route.indexOf("unmarshalPaddleWebhook")).toBeLessThan(route.indexOf("recordWebhookEvent"));
    expect(route).toContain("Invalid Paddle webhook signature");
    expect(route).not.toMatch(/grantPaid|markPaid|paidAccess = true/);
  });

  it("success page does not grant access", () => {
    const page = readFileSync(
      join(process.cwd(), "src/app/(portal)/billing/success/page.tsx"),
      "utf8"
    );
    expect(page).toContain("confirmation is pending");
    expect(page).toContain("verified webhook");
    expect(page).not.toMatch(/paidAccess/);
  });
});

describe("secrets and env example", () => {
  it("env example lists names only and never NEXT_PUBLIC API/webhook secrets", () => {
    const env = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    expect(env).toContain("PADDLE_ENVIRONMENT=sandbox");
    expect(env).toContain("PADDLE_PRICE_ARTIST_PRO_MONTHLY=");
    expect(env).not.toMatch(/NEXT_PUBLIC_PADDLE_API_KEY/);
    expect(env).not.toMatch(/NEXT_PUBLIC_PADDLE_WEBHOOK_SECRET/);
    expect(env).not.toMatch(/pdl_/);
    expect(catalogEnvNames().length).toBeGreaterThan(6);
  });

  it("catalog is not ready without price IDs", () => {
    const catalog = publicBillingCatalog({ PADDLE_ENVIRONMENT: "sandbox" } as NodeJS.ProcessEnv);
    expect(catalog.catalogReady).toBe(false);
  });

  it("still publishes USD list prices without Paddle client token or price IDs", () => {
    const catalog = publicBillingCatalog({} as NodeJS.ProcessEnv);
    expect(catalog.displayUsd.artist_pro.month).toBe("$9.99");
    expect(catalog.displayUsd.artist_pro.year).toBe("$99");
    expect(catalog.displayUsd.label_starter.month).toBe("$19.99");
    expect(catalog.displayUsd.label_starter.year).toBe("$199");
    expect(catalog.displayUsd.label_pro.month).toBe("$49.99");
    expect(catalog.displayUsd.label_pro.year).toBe("$499");
    expect(catalog.displayCountry.GB.artist_pro.month).toBe("£7.99");
    expect(catalog.displayCountry.IE.label_starter.year).toBe("€189");
    expect(catalog.displayCountry.AU.label_pro.year).toBe("A$749");
    expect(catalog.catalogReady).toBe(false);
  });
});
