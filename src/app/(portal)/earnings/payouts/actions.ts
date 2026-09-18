"use server";

import { revalidatePath } from "next/cache";
import { RequireVerifiedPortal } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  isPayoutMethodType,
  maskPayoutDestination,
  normalizeCountryCode,
  normalizeCurrency,
} from "@/lib/finance/payout-methods";

export type PayoutMethodActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type SafeMethodRow = {
  id: string;
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
  methodType: string;
  displayName: string;
  beneficiaryName: string;
  destination: string;
  institution?: string;
  countryCode?: string;
  currency?: string;
}): Promise<PayoutMethodActionResult<SafeMethodRow>> {
  const ctx = await RequireVerifiedPortal();
  const methodType = input.methodType.trim();
  const displayName = input.displayName.trim();
  const beneficiaryName = input.beneficiaryName.trim();
  const destination = input.destination.trim();
  const institution = input.institution?.trim() || null;
  const countryCode = normalizeCountryCode(input.countryCode);
  const currency = normalizeCurrency(input.currency);

  if (!isPayoutMethodType(methodType)) {
    return { ok: false, error: "Select a supported payout method." };
  }
  if (displayName.length < 2 || displayName.length > 120) {
    return { ok: false, error: "Method name must be 2–120 characters." };
  }
  if (beneficiaryName.length < 2 || beneficiaryName.length > 200) {
    return { ok: false, error: "Enter the payout beneficiary name." };
  }
  if (destination.length < 3 || destination.length > 320) {
    return { ok: false, error: "Enter a valid payout destination." };
  }
  if (input.countryCode?.trim() && !countryCode) {
    return { ok: false, error: "Country must be a two-letter country code." };
  }
  if (input.currency?.trim() && !currency) {
    return { ok: false, error: "Currency must be a three-letter ISO code." };
  }

  const service = createServiceClient();
  const destinationMask = maskPayoutDestination(destination);
  const { data, error } = await service
    .from("payout_methods")
    .insert({
      user_id: ctx.userId,
      method_type: methodType,
      display_name: displayName,
      country_code: countryCode,
      currency,
      beneficiary_name: beneficiaryName,
      details: {
        destination,
        destination_mask: destinationMask,
        institution,
      },
      provider: "manual",
      external_method_id: null,
      is_preferred: false,
      status: "verification_required",
      admin_note: null,
    })
    .select(
      "id,method_type,display_name,country_code,currency,beneficiary_name,details,is_preferred,status"
    )
    .single();

  if (error || !data) {
    return { ok: false, error: "Could not save the payout method." };
  }

  revalidatePath("/earnings/payouts");
  revalidatePath("/admin/payouts");
  return { ok: true, data: safeRow(data) };
}

export async function setPreferredPayoutMethodAction(
  methodId: string
): Promise<PayoutMethodActionResult<true>> {
  const ctx = await RequireVerifiedPortal();
  const service = createServiceClient();

  const { data: method, error: readError } = await service
    .from("payout_methods")
    .select("id,status")
    .eq("id", methodId)
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (readError || !method) {
    return { ok: false, error: "Payout method not found." };
  }
  if (method.status !== "active") {
    return { ok: false, error: "Only an approved payout method can be preferred." };
  }

  const { error: clearError } = await service
    .from("payout_methods")
    .update({ is_preferred: false })
    .eq("user_id", ctx.userId)
    .neq("id", methodId);
  if (clearError) {
    return { ok: false, error: "Could not update the preferred payout method." };
  }

  const { error } = await service
    .from("payout_methods")
    .update({ is_preferred: true })
    .eq("id", methodId)
    .eq("user_id", ctx.userId)
    .eq("status", "active");

  if (error) {
    return { ok: false, error: "Could not update the preferred payout method." };
  }

  revalidatePath("/earnings/payouts");
  return { ok: true, data: true };
}

export async function disablePayoutMethodAction(
  methodId: string
): Promise<PayoutMethodActionResult<true>> {
  const ctx = await RequireVerifiedPortal();
  const service = createServiceClient();

  const { error } = await service
    .from("payout_methods")
    .update({
      status: "disabled",
      is_preferred: false,
    })
    .eq("id", methodId)
    .eq("user_id", ctx.userId);

  if (error) {
    return { ok: false, error: "Could not remove the payout method." };
  }

  revalidatePath("/earnings/payouts");
  revalidatePath("/admin/payouts");
  return { ok: true, data: true };
}
