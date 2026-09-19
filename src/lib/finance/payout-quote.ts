import "server-only";

import { createServiceClient } from "@/lib/supabase/admin";

type FeeRule = {
  fee_kind: "nexo" | "provider";
  account_type: string | null;
  plan_segment: string | null;
  country_code: string | null;
  currency_code: string | null;
  method_id: string | null;
  provider_id: string | null;
  fixed_fee_minor: number | string;
  percentage_bps: number;
  fee_payer: "nexo" | "recipient" | "split";
  split_recipient_bps: number;
  priority: number;
};

function money(value: unknown): bigint {
  try {
    return BigInt(String(value ?? 0));
  } catch {
    return 0n;
  }
}

function roundRatio(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("Invalid financial denominator.");
  if (numerator < 0n) return -roundRatio(-numerator, denominator);
  return (2n * numerator + denominator) / (2n * denominator);
}

function feeAmount(amount: bigint, rule: FeeRule | undefined): bigint {
  if (!rule) return 0n;
  return money(rule.fixed_fee_minor) + roundRatio(amount * BigInt(rule.percentage_bps), 10000n);
}

function recipientShare(fee: bigint, rule: FeeRule | undefined): bigint {
  if (!rule || rule.fee_payer === "nexo") return 0n;
  if (rule.fee_payer === "recipient") return fee;
  return roundRatio(fee * BigInt(rule.split_recipient_bps), 10000n);
}

function specificity(rule: FeeRule): number {
  return [
    rule.account_type,
    rule.plan_segment,
    rule.country_code,
    rule.currency_code,
    rule.method_id,
    rule.provider_id,
  ].filter(Boolean).length;
}

function chooseRule(
  rows: FeeRule[],
  kind: "nexo" | "provider",
  context: {
    accountType: string;
    planSegment: string;
    countryCode: string;
    sourceCurrency: string;
    methodId: string;
    providerId: string;
  }
): FeeRule | undefined {
  return rows
    .filter(
      (row) =>
        row.fee_kind === kind &&
        (!row.account_type || row.account_type === context.accountType) &&
        (!row.plan_segment || row.plan_segment === context.planSegment) &&
        (!row.country_code || row.country_code === context.countryCode) &&
        (!row.currency_code || row.currency_code === context.sourceCurrency) &&
        (!row.method_id || row.method_id === context.methodId) &&
        (!row.provider_id || row.provider_id === context.providerId)
    )
    .sort((a, b) => specificity(b) - specificity(a) || a.priority - b.priority)[0];
}

export type PayoutQuote = {
  sourceCurrency: string;
  destinationCurrency: string;
  grossMinor: string;
  providerFeeMinor: string;
  nexoFeeMinor: string;
  fxFeeMinor: string;
  recipientMinor: string;
  fxRateNumerator: string;
  fxRateDenominator: string;
  providerName: string;
  methodName: string;
  destinationMask: string;
  minimumMinor: string;
  maximumMinor: string | null;
  availableMinor: string;
};

export async function quotePayout(input: {
  ownerUserId: string;
  amountMinor: string;
  sourceCurrency: string;
  payoutMethodId: string;
}): Promise<PayoutQuote> {
  const service = createServiceClient();
  const amount = money(input.amountMinor);
  const sourceCurrency = input.sourceCurrency.trim().toUpperCase();
  if (amount <= 0n) throw new Error("Enter a payout amount greater than zero.");

  const [{ data: profile }, { data: method }, { data: sourceCurrencyRow }, { data: security }] =
    await Promise.all([
      service
        .from("profiles")
        .select("id,account_type,account_status,restriction_kind")
        .eq("id", input.ownerUserId)
        .maybeSingle(),
      service
        .from("payout_methods")
        .select(
          "id,user_id,status,route_method_id,country_code,currency,beneficiary_type,destination_mask,encrypted_details,security_hold_until"
        )
        .eq("id", input.payoutMethodId)
        .eq("user_id", input.ownerUserId)
        .maybeSingle(),
      service
        .from("payout_currencies")
        .select("code,enabled,minimum_payout_minor,maximum_payout_minor,fx_enabled,fx_fee_bps,nexo_fx_markup_bps,fx_fee_payer,fx_split_recipient_bps")
        .eq("code", sourceCurrency)
        .maybeSingle(),
      service.from("payout_security_settings").select("*").eq("id", "default").maybeSingle(),
    ]);

  if (!profile || profile.account_status !== "active") throw new Error("Account is not eligible for payouts.");
  if (!method || method.status !== "active") throw new Error("Select an active payout method.");
  if (!method.encrypted_details) throw new Error("This payout method must be securely updated before it can be used.");
  if (!method.route_method_id || !method.country_code || !method.currency || !method.beneficiary_type) {
    throw new Error("This payout method is incomplete.");
  }
  if (method.security_hold_until && new Date(method.security_hold_until).getTime() > Date.now()) {
    throw new Error("This payout method is temporarily on a security hold after a recent change.");
  }
  if (!sourceCurrencyRow?.enabled) throw new Error("Source currency is not enabled for payouts.");

  const [
    { data: country },
    { data: destinationCurrencyRow },
    { data: methodCatalog },
    { data: routes },
    { data: planSegmentValue },
    { data: balance },
    { data: feeRows },
    { data: limitRows },
  ] = await Promise.all([
    service.from("payout_countries").select("*").eq("iso2", method.country_code).maybeSingle(),
    service.from("payout_currencies").select("*").eq("code", String(method.currency).trim()).maybeSingle(),
    service.from("payout_method_catalog").select("*").eq("id", method.route_method_id).maybeSingle(),
    service
      .from("payout_provider_routes")
      .select("*, payout_providers!inner(id,name,enabled,maintenance_mode,manual_payout_enabled,api_enabled,priority)")
      .eq("country_code", method.country_code)
      .eq("currency_code", String(method.currency).trim())
      .eq("method_id", method.route_method_id)
      .eq("beneficiary_type", method.beneficiary_type)
      .eq("enabled", true)
      .order("is_backup", { ascending: true })
      .order("priority", { ascending: true }),
    service.rpc("resolve_payout_plan_segment", { p_owner: input.ownerUserId }),
    service
      .from("ledger_balances")
      .select("available_minor")
      .eq("owner_user_id", input.ownerUserId)
      .eq("currency", sourceCurrency)
      .maybeSingle(),
    service.from("payout_fee_rules").select("*").eq("enabled", true),
    service.from("payout_limit_rules").select("*").eq("enabled", true),
  ]);

  if (!country?.enabled) throw new Error("Payouts are not enabled for this country.");
  if (!destinationCurrencyRow?.enabled) throw new Error("Destination currency is not enabled.");
  if (!methodCatalog?.enabled || methodCatalog.maintenance_mode) throw new Error("This payout method is unavailable.");

  const route = (routes ?? []).find((candidate: any) => {
    const provider = Array.isArray(candidate.payout_providers)
      ? candidate.payout_providers[0]
      : candidate.payout_providers;
    return provider?.enabled && !provider?.maintenance_mode && (provider?.manual_payout_enabled || provider?.api_enabled);
  }) as any;
  if (!route) throw new Error("No payout provider route is currently available.");
  const provider = Array.isArray(route.payout_providers)
    ? route.payout_providers[0]
    : route.payout_providers;

  const available = money(balance?.available_minor);
  if (amount > available) throw new Error("Requested amount exceeds available royalty balance.");

  const planSegment = String(planSegmentValue ?? "free");
  const feeContext = {
    accountType: String(profile.account_type),
    planSegment,
    countryCode: method.country_code,
    sourceCurrency,
    methodId: method.route_method_id,
    providerId: provider.id,
  };
  const rules = (feeRows ?? []) as FeeRule[];
  const providerRule = chooseRule(rules, "provider", feeContext);
  const nexoRule = chooseRule(rules, "nexo", feeContext);
  const providerFee = feeAmount(amount, providerRule);
  let nexoFee = feeAmount(amount, nexoRule);
  const recipientProviderFee = recipientShare(providerFee, providerRule);
  let recipientNexoFee = recipientShare(nexoFee, nexoRule);

  const matchingLimits = (limitRows ?? [])
    .filter((row: any) =>
      (!row.account_type || row.account_type === profile.account_type) &&
      (!row.plan_segment || row.plan_segment === planSegment) &&
      (!row.country_code || row.country_code === method.country_code) &&
      (!row.currency_code || row.currency_code === sourceCurrency) &&
      (!row.method_id || row.method_id === method.route_method_id) &&
      (!row.provider_id || row.provider_id === provider.id)
    )
    .sort((a: any, b: any) => {
      const sa = [a.account_type,a.plan_segment,a.country_code,a.currency_code,a.method_id,a.provider_id].filter(Boolean).length;
      const sb = [b.account_type,b.plan_segment,b.country_code,b.currency_code,b.method_id,b.provider_id].filter(Boolean).length;
      return sb - sa || Number(a.priority) - Number(b.priority);
    });
  const limit = matchingLimits[0] as any;

  const sameCurrency = sourceCurrency === String(method.currency).trim();
  const minimums = [
    money(sourceCurrencyRow.minimum_payout_minor),
    sameCurrency ? money(country.minimum_payout_minor) : 0n,
    sameCurrency ? money(route.minimum_payout_minor) : 0n,
    money(limit?.minimum_payout_minor),
  ];
  const minimum = minimums.reduce((max, value) => (value > max ? value : max), 0n);
  const maxima = [
    sourceCurrencyRow.maximum_payout_minor,
    sameCurrency ? country.maximum_payout_minor : null,
    sameCurrency ? route.maximum_payout_minor : null,
    limit?.maximum_payout_minor,
  ]
    .filter((value) => value !== null && value !== undefined)
    .map(money);
  const maximum = maxima.length ? maxima.reduce((min, value) => (value < min ? value : min)) : null;
  if (amount < minimum) throw new Error("Requested amount is below the minimum payout.");
  if (maximum !== null && amount > maximum) throw new Error("Requested amount exceeds the maximum payout.");

  let fxFee = 0n;
  let fxNumerator = 1n;
  let fxDenominator = 1n;
  if (!sameCurrency) {
    if (!sourceCurrencyRow.fx_enabled || !destinationCurrencyRow.fx_enabled) {
      throw new Error("Currency conversion is not enabled for this payout route.");
    }
    const { data: fx } = await service
      .from("payout_fx_rates")
      .select("rate_numerator,rate_denominator")
      .eq("source_currency", sourceCurrency)
      .eq("destination_currency", String(method.currency).trim())
      .eq("enabled", true)
      .lte("effective_at", new Date().toISOString())
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("effective_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!fx) throw new Error("A current exchange rate is not available for this payout route.");
    fxNumerator = money(fx.rate_numerator);
    fxDenominator = money(fx.rate_denominator);
    fxFee = roundRatio(amount * BigInt(sourceCurrencyRow.fx_fee_bps ?? 0), 10000n);
    const markup = roundRatio(amount * BigInt(sourceCurrencyRow.nexo_fx_markup_bps ?? 0), 10000n);
    nexoFee += markup;
    const baseNexoFee = feeAmount(amount, nexoRule);
    recipientNexoFee = recipientShare(baseNexoFee, nexoRule) + markup;
  }

  const recipientFxFee =
    sourceCurrencyRow.fx_fee_payer === "nexo"
      ? 0n
      : sourceCurrencyRow.fx_fee_payer === "split"
        ? roundRatio(fxFee * BigInt(sourceCurrencyRow.fx_split_recipient_bps ?? 5000), 10000n)
        : fxFee;
  const netSource = amount - recipientProviderFee - recipientNexoFee - recipientFxFee;
  if (netSource <= 0n) throw new Error("Configured fees exceed the payout amount.");
  const recipient = sameCurrency ? netSource : roundRatio(netSource * fxNumerator, fxDenominator);

  return {
    sourceCurrency,
    destinationCurrency: String(method.currency).trim(),
    grossMinor: amount.toString(),
    providerFeeMinor: providerFee.toString(),
    nexoFeeMinor: nexoFee.toString(),
    fxFeeMinor: fxFee.toString(),
    recipientMinor: recipient.toString(),
    fxRateNumerator: fxNumerator.toString(),
    fxRateDenominator: fxDenominator.toString(),
    providerName: String(provider.name),
    methodName: String(methodCatalog.name),
    destinationMask: String(method.destination_mask ?? "Secure destination"),
    minimumMinor: minimum.toString(),
    maximumMinor: maximum?.toString() ?? null,
    availableMinor: available.toString(),
  };
}
