"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { initializePaddle, type Paddle, type Environments } from "@paddle/paddle-js";
import { ArrowRight, Check } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/marketing/Section";
import { cn } from "@/lib/utils";
import type { PublicBillingCatalog } from "@/lib/billing/catalog";
import { paddleAddressForPreview } from "@/lib/billing/country";
import { loginHrefForPlan, registerHrefForPlan } from "@/lib/billing/auth-return";
import type { BillingAccountType, BillingInterval, OverrideCountryCode, PaidTierId, TierId } from "@/lib/billing/plans";
import { PADDLE_VERIFICATION_LINKS } from "@/lib/legal/public-links";

type AuthSlice = {
  signedIn: boolean;
  email: string | null;
  accountType: BillingAccountType | null;
};

type FormattedMap = Partial<Record<PaidTierId, string>>;

export function PricingTable({
  initialCatalog,
  initialCountry,
  clientToken,
  auth,
  initialAccountType,
  initialInterval,
  autoCheckoutPlan,
}: {
  initialCatalog: PublicBillingCatalog;
  initialCountry: string | null;
  clientToken: string;
  auth: AuthSlice;
  initialAccountType: BillingAccountType;
  initialInterval: BillingInterval;
  autoCheckoutPlan: PaidTierId | null;
}) {
  const router = useRouter();
  const [accountType, setAccountType] = React.useState<BillingAccountType>(initialAccountType);
  const [interval, setInterval] = React.useState<BillingInterval>(initialInterval);
  const [catalog] = React.useState(initialCatalog);
  const [formatted, setFormatted] = React.useState<FormattedMap>({});
  const [checkoutError, setCheckoutError] = React.useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = React.useState<string | null>(null);
  const paddleRef = React.useRef<Paddle | null>(null);
  const autoStarted = React.useRef(false);

  const tiers = catalog.tiers.filter((t) => t.accountType === accountType);
  const priceEntries = catalog.prices[accountType][interval === "month" ? "month" : "year"];

  const priceIdKey = priceEntries.map((p) => p.priceId).join(",");

  React.useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (!clientToken || !catalog.environment || !priceIdKey) return;
      try {
        if (!paddleRef.current) {
          const instance = await initializePaddle({
            token: clientToken,
            environment: catalog.environment as Environments,
          });
          if (!instance) throw new Error("Paddle.js failed to initialize.");
          paddleRef.current = instance;
        }
        const address = paddleAddressForPreview(initialCountry);
        const entries = catalog.prices[accountType][interval === "month" ? "month" : "year"];
        const items = entries.map((p) => ({ priceId: p.priceId, quantity: 1 }));
        if (items.length === 0) {
          setFormatted({});
          return;
        }
        const result = await paddleRef.current.PricePreview({
          items,
          ...(address ? { address } : {}),
        });
        if (cancelled) return;
        const next: FormattedMap = {};
        for (const line of result.data.details.lineItems) {
          const match = entries.find((p) => p.priceId === line.price.id);
          if (match) {
            next[match.tierId] = line.formattedTotals.total;
          }
        }
        setFormatted(next);
      } catch {
        if (!cancelled) {
          setFormatted({});
        }
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [priceIdKey, clientToken, catalog.environment, catalog.prices, accountType, interval, initialCountry]);

  async function startCheckout(planId: PaidTierId) {
    setCheckoutError(null);
    if (!auth.signedIn) {
      const href =
        auth.accountType && auth.accountType !== accountType
          ? loginHrefForPlan({ planId, interval })
          : registerHrefForPlan({ planId, interval, accountType });
      router.push(auth.signedIn ? loginHrefForPlan({ planId, interval }) : href);
      return;
    }
    if (auth.accountType && auth.accountType !== accountType) {
      setCheckoutError(
        auth.accountType === "artist"
          ? "This account is an artist account and cannot purchase Label plans."
          : "This account is a label account and cannot purchase Artist plans."
      );
      return;
    }
    setCheckoutLoading(planId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, interval }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        priceId?: string;
        email?: string;
        customData?: Record<string, string>;
        settings?: {
          displayMode: "overlay";
          variant: "one-page";
          successUrl: string;
          allowLogout: boolean;
        };
      };
      if (!res.ok || !json.ok || !json.priceId) {
        throw new Error(json.error || "Checkout could not start.");
      }
      if (!paddleRef.current) {
        if (!clientToken || !catalog.environment) {
          throw new Error("Paddle.js is not configured.");
        }
        const instance = await initializePaddle({
          token: clientToken,
          environment: catalog.environment as Environments,
        });
        if (!instance) throw new Error("Paddle.js failed to initialize.");
        paddleRef.current = instance;
      }
      paddleRef.current.Checkout.open({
        items: [{ priceId: json.priceId, quantity: 1 }],
        customer: json.email ? { email: json.email } : undefined,
        customData: json.customData,
        settings: {
          displayMode: "overlay",
          variant: "one-page",
          successUrl: json.settings?.successUrl,
          allowLogout: false,
        },
      });
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Checkout could not start.");
    } finally {
      setCheckoutLoading(null);
    }
  }

  React.useEffect(() => {
    if (autoStarted.current) return;
    if (!autoCheckoutPlan) return;
    if (!auth.signedIn) return;
    autoStarted.current = true;
    void startCheckout(autoCheckoutPlan);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot after login return
  }, [autoCheckoutPlan, auth.signedIn]);

  const toggleClass = (active: boolean) =>
    cn(
      "rounded-full px-4 py-2 text-small font-medium transition-colors",
      active
        ? "bg-[var(--nexo-primary)] [color:var(--nexo-primary-fg)]"
        : "text-[var(--nexo-text-muted)] hover:text-[var(--nexo-text)]"
    );

  return (
    <div>
      <div className="flex flex-col items-center gap-4">
        <div
          className="inline-flex rounded-full border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-1"
          role="tablist"
          aria-label="Account type"
        >
          <button type="button" className={toggleClass(accountType === "artist")} onClick={() => setAccountType("artist")}>
            Artists
          </button>
          <button type="button" className={toggleClass(accountType === "label")} onClick={() => setAccountType("label")}>
            Labels
          </button>
        </div>
        <div
          className="inline-flex rounded-full border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-1"
          role="tablist"
          aria-label="Billing interval"
        >
          <button type="button" className={toggleClass(interval === "month")} onClick={() => setInterval("month")}>
            Monthly
          </button>
          <button type="button" className={toggleClass(interval === "year")} onClick={() => setInterval("year")}>
            Annual
          </button>
        </div>
        <p className="max-w-xl text-center text-caption text-[var(--nexo-text-muted)]">
          {Object.keys(formatted).length > 0
            ? "Localized totals including estimated tax come from Paddle PricePreview."
            : listPriceCaption(initialCountry)}{" "}
          Plans cover Nexo distribution operations. Storefront or DSP acceptance and income are not guaranteed.
        </p>
      </div>

      {checkoutError ? (
        <Alert variant="error" title="Checkout" className="mt-8">
          {checkoutError}
        </Alert>
      ) : null}

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {tiers.map((tier) => {
          const paid = !tier.free && tier.id !== "artist_starter";
          const usd =
            paid && tier.id in catalog.displayUsd
              ? catalog.displayUsd[tier.id as PaidTierId][interval === "month" ? "month" : "year"]
              : "Free";
          const countryDisplay =
            paid && initialCountry && initialCountry in catalog.displayCountry
              ? catalog.displayCountry[initialCountry as OverrideCountryCode][tier.id as PaidTierId][
                  interval === "month" ? "month" : "year"
                ]
              : undefined;
          const paddleTotal = paid ? formatted[tier.id as PaidTierId] : undefined;
          const priceLabel = paid ? paddleTotal ?? countryDisplay ?? usd : "$0";
          const cta = checkoutCta({
            tierId: tier.id as TierId,
            paid: Boolean(paid),
            signedIn: auth.signedIn,
            accountType: auth.accountType,
            selectedAccountType: accountType,
            interval,
          });
          return (
            <article
              key={tier.id}
              className="flex flex-col rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6"
            >
              <Eyebrow>{accountType === "artist" ? "Artist" : "Label"}</Eyebrow>
              <h2 className="mt-3 text-h3">{tier.name}</h2>
              <p className="mt-2 text-small text-[var(--nexo-text-muted)]">{tier.description}</p>
              <p className="mt-6 text-h2 tabular-nums">{priceLabel}</p>
              {paid && interval === "year" ? (
                <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">Billed annually</p>
              ) : paid ? (
                <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">Billed monthly</p>
              ) : (
                <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">Free — no Paddle subscription</p>
              )}
              {tier.trialDays && paid ? (
                <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
                  {tier.trialDays}-day trial on monthly and annual plans
                </p>
              ) : null}
              <ul className="mt-6 flex-1 space-y-2">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2 text-small text-[var(--nexo-text-secondary)]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {cta.kind === "button" ? (
                <Button
                  className="mt-6 gap-2 rounded-full"
                  disabled={Boolean(checkoutLoading)}
                  onClick={() => startCheckout(tier.id as PaidTierId)}
                >
                  {checkoutLoading === tier.id ? "Opening checkout…" : cta.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Link href={cta.href} className="mt-6 inline-flex">
                  <Button variant={paid ? "primary" : "outline"} className="gap-2 rounded-full">
                    {cta.label}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              )}
              <CheckoutLegalLinks />
            </article>
          );
        })}
      </div>
    </div>
  );
}

function checkoutCta(input: {
  tierId: TierId;
  paid: boolean;
  signedIn: boolean;
  accountType: BillingAccountType | null;
  selectedAccountType: BillingAccountType;
  interval: BillingInterval;
}): { kind: "button"; label: string } | { kind: "link"; href: string; label: string } {
  if (!input.paid) {
    return {
      kind: "link",
      href: input.signedIn ? "/dashboard" : "/register?type=artist",
      label: input.signedIn ? "Go to dashboard" : "Get started free",
    };
  }
  if (!input.signedIn) {
    return {
      kind: "link",
      href: registerHrefForPlan({
        planId: input.tierId as PaidTierId,
        interval: input.interval,
        accountType: input.selectedAccountType,
      }),
      label: "Subscribe",
    };
  }
  return { kind: "button", label: "Subscribe" };
}

function CheckoutLegalLinks() {
  const links = PADDLE_VERIFICATION_LINKS.filter((l) => l.href !== "/pricing");
  return (
    <p className="mt-3 text-caption text-[var(--nexo-text-muted)]">
      {links.map((l, i) => (
        <span key={l.href}>
          {i > 0 ? " · " : null}
          <Link href={l.href} className="underline underline-offset-4 hover:text-[var(--nexo-text)]">
            {l.label}
          </Link>
        </span>
      ))}
    </p>
  );
}

function listPriceCaption(country: string | null): string {
  if (country === "GB") {
    return "List prices shown in GBP for the United Kingdom. Tax is calculated by Paddle at checkout.";
  }
  if (country === "IE") {
    return "List prices shown in EUR for Ireland. Tax is calculated by Paddle at checkout.";
  }
  if (country === "AU") {
    return "List prices shown in AUD for Australia. Tax is calculated by Paddle at checkout.";
  }
  return "Prices shown in USD. Applicable tax is calculated by Paddle at checkout.";
}
