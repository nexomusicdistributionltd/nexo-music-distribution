"use server";

import { revalidatePath } from "next/cache";
import { RequireVerifiedPortal } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  maskPayoutDestination,
  normalizeCountryCode,
  normalizeCurrency,
} from "@/lib/finance/payout-methods";

export type PayoutMethodActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type SafeMethodRow = {
  id: string;
  option_id: string | null;
  method_type: string;
  display_name: string;
  country_code: string | null;
  currency: string | null;
  beneficiary_name: string;
  destination_mask: string;
  is_preferred: boolean;
  status: string;
};

function safeRow(row: {
  id: string;
  option_id?: string | null;
  method_type: string;
  display_name: string;
  country_code: string | null;
  currency: string | null;
  beneficiary_name: string;
  details: unknown;
  is_preferred: boolean;
  status: string;
}): SafeMethodRow {
  const details =
    row.details && typeof row.details === "object" && !Array.isArray(row.details)
      ? (row.details as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    option_id: row.option_id ?? null,
    method_type: row.method_type,
    display_name: row.display_name,
    country_code: row.country_code,
    currency: row.currency ? String(row.currency).trim() : null,
    beneficiary_name: row.beneficiary_name,
    destination_mask:
      typeof details.destination_mask === "string"
        ? details.destination_mask
        : "Secure destination",
    is_preferred: row.is_preferred,
    status: row.status,
  };
}

export async function savePayoutMethodAction(input: {
  optionId: string;
  displayName?: string;
  beneficiaryName: string;
  destination: string;
  institution?: string;
  countryCode?: string;
  currency?: string;
}): Promise<PayoutMethodActionResult<SafeMethodRow>> {
  const ctx = await RequireVerifiedPortal();
  const beneficiaryName = input.beneficiaryName.trim();
  const destination = input.destination.trim();
  const institution = input.institution?.trim() || null;
  const countryCode = normalizeCountryCode(input.countryCode);
  const currency = normalizeCurrency(input.currency);
  const db = createServiceClient();

  const { data: option, error: optionError } = await db
    .from("payout_method_options")
    .select("id,code,display_name,method_type,destination_label,instructions,requires_institution,requires_country,requires_currency,requires_review,allowed_countries,allowed_currencies,is_enabled")
    .eq("id", input.optionId)
    .eq("is_enabled", true)
    .maybeSingle();

  if (optionError || !option) {
    return { ok: false, error: "Select an available payout method." };
  }

  const displayName =
    input.displayName?.trim() || String(option.display_name || "Payout method");

  if (displayName.length < 2 || displayName.length > 120) {
    return { ok: false, error: "Method name must be 2–120 characters." };
  }
  if (beneficiaryName.length < 2 || beneficiaryName.length > 200) {
    return { ok: false, error: "Enter the payout beneficiary name." };
  }
  if (destination.length < 3 || destination.length > 320) {
    return { ok: false, error: `Enter a valid ${String(option.destination_label || "payout destination").toLowerCase()}.` };
  }
  if (option.requires_institution && !institution) {
    return { ok: false, error: "Enter the bank or payment provider." };
  }
  if (option.requires_country && !countryCode) {
    return { ok: false, error: "Select or enter a valid two-letter country code." };
  }
  if (input.countryCode?.trim() && !countryCode) {
    return { ok: false, error: "Country must be a two-letter country code." };
  }
  if (option.requires_currency && !currency) {
    return { ok: false, error: "Enter the payout currency." };
  }
  if (input.currency?.trim() && !currency) {
    return { ok: false, error: "Currency must be a three-letter ISO code." };
  }

  const allowedCountries = Array.isArray(option.allowed_countries)
    ? option.allowed_countries.map((value: string) => value.toUpperCase())
    : [];
  if (countryCode && allowedCountries.length > 0 && !allowedCountries.includes(countryCode)) {
    return { ok: false, error: "This payout method is not enabled for the selected country." };
  }

  const allowedCurrencies = Array.isArray(option.allowed_currencies)
    ? option.allowed_currencies.map((value: string) => value.toUpperCase())
    : [];
  if (currency && allowedCurrencies.length > 0 && !allowedCurrencies.includes(currency)) {
    return { ok: false, error: "This payout method is not enabled for the selected currency." };
  }

  const destinationMask = maskPayoutDestination(destination);
  const status = option.requires_review ? "verification_required" : "active";
  const { data, error } = await db
    .from("payout_methods")
    .insert({
      user_id: ctx.userId,
      option_id: option.id,
      method_type: option.method_type,
      display_name: displayName,
      country_code: countryCode,
      currency,
      beneficiary_name: beneficiaryName,
      details: {
        destination,
        destination_mask: destinationMask,
        institution,
        option_code: option.code,
      },
      provider: "manual",
      external_method_id: null,
      is_preferred: false,
      status,
      admin_note: null,
    })
    .select(
      "id,option_id,method_type,display_name,country_code,currency,beneficiary_name,details,is_preferred,status"
    )
    .single();

  if (error || !data) {
    return { ok: false, error: "Could not save the payout method." };
  }

  revalidatePath("/wallet");
  revalidatePath("/earnings/payouts");
  revalidatePath("/admin/finance/payout-methods");
  return { ok: true, data: safeRow(data) };
}

export async function setPreferredPayoutMethodAction(
  methodId: string
): Promise<PayoutMethodActionResult<true>> {
  const ctx = await RequireVerifiedPortal();
  const db = createServiceClient();

  const { data: method, error: readError } = await db
    .from("payout_methods")
    .select("id,status")
    .eq("id", methodId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (readError || !method) return { ok: false, error: "Payout method not found." };
  if (method.status !== "active") {
    return { ok: false, error: "Only an approved payout method can be preferred." };
  }

  const { error: clearError } = await db
    .from("payout_methods")
    .update({ is_preferred: false })
    .eq("user_id", ctx.userId)
    .neq("id", methodId);
  if (clearError) return { ok: false, error: "Could not update the preferred payout method." };

  const { error } = await db
    .from("payout_methods")
    .update({ is_preferred: true })
    .eq("id", methodId)
    .eq("user_id", ctx.userId)
    .eq("status", "active");
  if (error) return { ok: false, error: "Could not update the preferred payout method." };

  revalidatePath("/wallet");
  revalidatePath("/earnings/payouts");
  return { ok: true, data: true };
}

export async function disablePayoutMethodAction(
  methodId: string
): Promise<PayoutMethodActionResult<true>> {
  const ctx = await RequireVerifiedPortal();
  const db = createServiceClient();
  const { error } = await db
    .from("payout_methods")
    .update({ status: "disabled", is_preferred: false })
    .eq("id", methodId)
    .eq("user_id", ctx.userId);
  if (error) return { ok: false, error: "Could not remove the payout method." };

  revalidatePath("/wallet");
  revalidatePath("/earnings/payouts");
  revalidatePath("/admin/finance/payout-methods");
  return { ok: true, data: true };
}
