"use server";

import { revalidatePath } from "next/cache";
import { RequireVerifiedPortal } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  encryptPayoutPayload,
  PayoutEncryptionUnavailableError,
} from "@/lib/finance/payout-crypto";
import {
  maskConfiguredPayoutDestination,
  payoutBeneficiaryName,
  payoutInstitutionName,
  safePayoutPublicDetails,
  validateConfiguredPayoutValues,
  type ConfiguredPayoutField,
  type PayoutFieldValues,
} from "@/lib/finance/payout-config";

export type PayoutMethodActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type SafePayoutMethodRow = {
  id: string;
  method_type: string;
  route_method_id: string | null;
  display_name: string;
  country_code: string | null;
  currency: string | null;
  beneficiary_type: string | null;
  beneficiary_name: string;
  destination_mask: string;
  institution_name: string | null;
  provider: string;
  is_preferred: boolean;
  status: string;
  security_hold_until: string | null;
  last_sensitive_change_at: string | null;
};

type MethodDbRow = SafePayoutMethodRow & {
  public_details?: unknown;
};

function safeRow(row: MethodDbRow): SafePayoutMethodRow {
  return {
    id: row.id,
    method_type: row.method_type,
    route_method_id: row.route_method_id,
    display_name: row.display_name,
    country_code: row.country_code,
    currency: row.currency ? String(row.currency).trim() : null,
    beneficiary_type: row.beneficiary_type,
    beneficiary_name: row.beneficiary_name,
    destination_mask: row.destination_mask || "Secure destination",
    institution_name: row.institution_name,
    provider: row.provider,
    is_preferred: row.is_preferred,
    status: row.status,
    security_hold_until: row.security_hold_until,
    last_sensitive_change_at: row.last_sensitive_change_at,
  };
}

function normalizeCountry(value: string): string | null {
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function normalizeCurrency(value: string): string | null {
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

function revalidatePayoutViews() {
  revalidatePath("/earnings");
  revalidatePath("/earnings/payouts");
  revalidatePath("/earnings/payout-methods");
  revalidatePath("/earnings/request-payout");
  revalidatePath("/earnings/payout-history");
  revalidatePath("/admin/payouts");
  revalidatePath("/admin/finance/payout-methods");
}

async function queueMethodSecurityMessage(input: {
  userId: string;
  payoutMethodId: string;
  event: "added" | "changed" | "disabled";
  countryCode: string | null;
  currency: string | null;
  methodName: string;
  destinationMask: string;
}) {
  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("email")
    .eq("id", input.userId)
    .maybeSingle();

  const title =
    input.event === "added"
      ? "Payout method added"
      : input.event === "disabled"
        ? "Payout method removed"
        : "Your Nexo payout information was changed";

  await service.from("notifications").insert({
    user_id: input.userId,
    type: "payout_update",
    title,
    body:
      input.event === "changed"
        ? "Your payout information was changed. Review it now if you did not make this change."
        : input.event === "added"
          ? "A new payout method was added to your account."
          : "A payout method was removed from your account.",
    entity_type: "payout_method",
    entity_id: input.payoutMethodId,
    metadata: { href: "/earnings/payout-methods" },
  });

  if (profile?.email) {
    await service.from("email_outbound_events").insert({
      to_email: profile.email,
      template_key: "payout_method_changed",
      payload: {
        event: input.event,
        payout_method_id: input.payoutMethodId,
        date: new Date().toISOString(),
        country: input.countryCode,
        currency: input.currency,
        payment_method: input.methodName,
        masked_account: input.destinationMask,
      },
      status: "pending",
      related_entity_type: "payout_method",
      related_entity_id: input.payoutMethodId,
    });
  }
}

export async function savePayoutMethodAction(input: {
  payoutMethodId?: string;
  countryCode: string;
  beneficiaryType: "individual" | "business";
  currency: string;
  methodCatalogId: string;
  fieldValues: PayoutFieldValues;
}): Promise<PayoutMethodActionResult<SafePayoutMethodRow>> {
  const ctx = await RequireVerifiedPortal();
  const service = createServiceClient();
  const countryCode = normalizeCountry(input.countryCode);
  const currency = normalizeCurrency(input.currency);
  const beneficiaryType = input.beneficiaryType;

  if (!countryCode) return { ok: false, error: "Select a valid payout country." };
  if (!currency) return { ok: false, error: "Select a valid payout currency." };
  if (!["individual", "business"].includes(beneficiaryType)) {
    return { ok: false, error: "Select a beneficiary type." };
  }
  if (!/^[0-9a-f-]{36}$/i.test(input.methodCatalogId)) {
    return { ok: false, error: "Select a valid payout method." };
  }

  const [
    { data: country },
    { data: currencyRow },
    { data: catalog },
    { data: fieldRows },
    { data: routes },
  ] = await Promise.all([
    service
      .from("payout_countries")
      .select("iso2,name,enabled,individual_enabled,business_enabled")
      .eq("iso2", countryCode)
      .maybeSingle(),
    service
      .from("payout_currencies")
      .select("code,name,enabled")
      .eq("code", currency)
      .maybeSingle(),
    service
      .from("payout_method_catalog")
      .select("id,code,name,enabled,maintenance_mode")
      .eq("id", input.methodCatalogId)
      .maybeSingle(),
    service
      .from("payout_method_fields")
      .select(
        "id,field_key,display_label,input_type,required,placeholder,help_text,minimum_length,maximum_length,validation_regex,numeric_only,display_order,encrypted,masked,enabled,options"
      )
      .eq("country_code", countryCode)
      .eq("currency_code", currency)
      .eq("method_id", input.methodCatalogId)
      .eq("beneficiary_type", beneficiaryType)
      .eq("enabled", true)
      .order("display_order"),
    service
      .from("payout_provider_routes")
      .select("id,provider_id,enabled,priority,is_backup")
      .eq("country_code", countryCode)
      .eq("currency_code", currency)
      .eq("method_id", input.methodCatalogId)
      .eq("beneficiary_type", beneficiaryType)
      .eq("enabled", true)
      .order("is_backup", { ascending: true })
      .order("priority", { ascending: true }),
  ]);

  if (!country?.enabled) return { ok: false, error: "This country is not enabled for payouts." };
  if (beneficiaryType === "individual" && !country.individual_enabled) {
    return { ok: false, error: "Individual beneficiaries are not enabled for this country." };
  }
  if (beneficiaryType === "business" && !country.business_enabled) {
    return { ok: false, error: "Business beneficiaries are not enabled for this country." };
  }
  if (!currencyRow?.enabled) return { ok: false, error: "This currency is not enabled for payouts." };
  if (!catalog?.enabled || catalog.maintenance_mode) {
    return { ok: false, error: "This payout method is not currently available." };
  }
  if (!fieldRows?.length) {
    return { ok: false, error: "This payout route has not been configured yet." };
  }

  const routeCandidates = routes ?? [];
  let selectedRoute: { id: string; provider_id: string } | null = null;
  let selectedProvider: { id: string; code: string; name: string } | null = null;
  for (const route of routeCandidates) {
    const { data: provider } = await service
      .from("payout_providers")
      .select("id,code,name,enabled,maintenance_mode,manual_payout_enabled,api_enabled")
      .eq("id", route.provider_id)
      .maybeSingle();
    if (
      provider?.enabled &&
      !provider.maintenance_mode &&
      (provider.manual_payout_enabled || provider.api_enabled)
    ) {
      selectedRoute = { id: route.id, provider_id: route.provider_id };
      selectedProvider = { id: provider.id, code: provider.code, name: provider.name };
      break;
    }
  }
  if (!selectedRoute || !selectedProvider) {
    return { ok: false, error: "No payout provider route is currently available." };
  }

  const fields = (fieldRows ?? []) as ConfiguredPayoutField[];
  const validated = validateConfiguredPayoutValues(fields, input.fieldValues);
  if (!validated.ok) return validated;

  const networkField = fields.find(
    (field) => field.input_type === "mobile_network_selector"
  );
  if (networkField) {
    const networkCode = String(validated.values[networkField.field_key] ?? "").trim();
    const { data: network } = await service
      .from("payout_mobile_networks")
      .select("id")
      .eq("country_code", countryCode)
      .eq("code", networkCode)
      .eq("enabled", true)
      .maybeSingle();
    if (!network) {
      return { ok: false, error: "Select a supported mobile network." };
    }
  }

  const beneficiaryName = payoutBeneficiaryName(validated.values);
  if (beneficiaryName.length < 2) {
    return { ok: false, error: "Enter the legal beneficiary name." };
  }
  const destinationMask = maskConfiguredPayoutDestination(fields, validated.values);
  const institutionName = payoutInstitutionName(validated.values);
  let encryptedDetails: string;
  try {
    encryptedDetails = encryptPayoutPayload({
      country_code: countryCode,
      currency,
      beneficiary_type: beneficiaryType,
      method_code: catalog.code,
      fields: validated.values,
    });
  } catch (error) {
    if (error instanceof PayoutEncryptionUnavailableError) {
      return {
        ok: false,
        error: "Secure payout storage is not configured. Please contact Nexo Support.",
      };
    }
    return { ok: false, error: "Could not securely protect the payout details." };
  }

  let existing:
    | {
        id: string;
        country_code: string | null;
        currency: string | null;
        route_method_id: string | null;
        beneficiary_type: string | null;
      }
    | null = null;
  if (input.payoutMethodId) {
    const { data } = await service
      .from("payout_methods")
      .select("id,country_code,currency,route_method_id,beneficiary_type")
      .eq("id", input.payoutMethodId)
      .eq("user_id", ctx.userId)
      .maybeSingle();
    existing = data;
    if (!existing) return { ok: false, error: "Payout method not found." };

    const routeChanged =
      existing.country_code !== countryCode ||
      String(existing.currency ?? "").trim() !== currency ||
      existing.route_method_id !== input.methodCatalogId ||
      existing.beneficiary_type !== beneficiaryType;
    if (routeChanged) {
      const { data: activePayout } = await service
        .from("payouts")
        .select("id")
        .eq("payout_method_id", existing.id)
        .in("status", ["pending", "under_review", "approved", "processing", "on_hold"])
        .limit(1)
        .maybeSingle();
      if (activePayout) {
        return {
          ok: false,
          error: "The payout route cannot be changed while it is attached to an active payout.",
        };
      }
    }
  }

  const displayName = [country.name, currency, catalog.name].filter(Boolean).join(" · ");
  const write = {
    user_id: ctx.userId,
    method_type: catalog.code,
    route_method_id: catalog.id,
    display_name: displayName.slice(0, 120),
    country_code: countryCode,
    currency,
    beneficiary_type: beneficiaryType,
    beneficiary_name: beneficiaryName.slice(0, 200),
    details: {},
    encrypted_details: encryptedDetails,
    destination_mask: destinationMask,
    institution_name: institutionName,
    public_details: safePayoutPublicDetails(validated.values),
    provider: selectedProvider.code,
    external_method_id: null,
    status: "active",
    admin_note: null,
  };

  let data: MethodDbRow | null = null;
  let error: { message: string } | null = null;
  if (existing) {
    const result = await service
      .from("payout_methods")
      .update(write)
      .eq("id", existing.id)
      .eq("user_id", ctx.userId)
      .select(
        "id,method_type,route_method_id,display_name,country_code,currency,beneficiary_type,beneficiary_name,destination_mask,institution_name,provider,is_preferred,status,security_hold_until,last_sensitive_change_at,public_details"
      )
      .single();
    data = result.data as MethodDbRow | null;
    error = result.error;
  } else {
    const result = await service
      .from("payout_methods")
      .insert({ ...write, is_preferred: false })
      .select(
        "id,method_type,route_method_id,display_name,country_code,currency,beneficiary_type,beneficiary_name,destination_mask,institution_name,provider,is_preferred,status,security_hold_until,last_sensitive_change_at,public_details"
      )
      .single();
    data = result.data as MethodDbRow | null;
    error = result.error;
  }

  if (error || !data) {
    return { ok: false, error: "Could not save the payout method." };
  }

  await service.from("audit_logs").insert({
    actor_user_id: ctx.userId,
    action: existing ? "payout_method_update" : "payout_method_create",
    entity_type: "payout_method",
    entity_id: data.id,
    metadata: {
      country_code: countryCode,
      currency,
      beneficiary_type: beneficiaryType,
      method_code: catalog.code,
      provider_id: selectedProvider.id,
      destination_mask: destinationMask,
    },
  });

  await queueMethodSecurityMessage({
    userId: ctx.userId,
    payoutMethodId: data.id,
    event: existing ? "changed" : "added",
    countryCode,
    currency,
    methodName: catalog.name,
    destinationMask,
  });

  revalidatePayoutViews();
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

  if (readError || !method) return { ok: false, error: "Payout method not found." };
  if (method.status !== "active") {
    return { ok: false, error: "Only an active payout method can be set as default." };
  }

  const { error: clearError } = await service
    .from("payout_methods")
    .update({ is_preferred: false })
    .eq("user_id", ctx.userId)
    .neq("id", methodId);
  if (clearError) return { ok: false, error: "Could not update the default payout method." };

  const { error } = await service
    .from("payout_methods")
    .update({ is_preferred: true })
    .eq("id", methodId)
    .eq("user_id", ctx.userId)
    .eq("status", "active");
  if (error) return { ok: false, error: "Could not update the default payout method." };

  await service.from("audit_logs").insert({
    actor_user_id: ctx.userId,
    action: "payout_default_method_change",
    entity_type: "payout_method",
    entity_id: methodId,
    metadata: {},
  });

  revalidatePayoutViews();
  return { ok: true, data: true };
}

export async function disablePayoutMethodAction(
  methodId: string
): Promise<PayoutMethodActionResult<true>> {
  const ctx = await RequireVerifiedPortal();
  const service = createServiceClient();

  const { data: method } = await service
    .from("payout_methods")
    .select("id,country_code,currency,method_type,destination_mask")
    .eq("id", methodId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (!method) return { ok: false, error: "Payout method not found." };

  const { error } = await service
    .from("payout_methods")
    .update({ status: "disabled", is_preferred: false })
    .eq("id", methodId)
    .eq("user_id", ctx.userId);

  if (error) {
    if (/active payout/i.test(error.message)) {
      return { ok: false, error: "This payout method is attached to an active payout." };
    }
    return { ok: false, error: "Could not remove the payout method." };
  }

  await service.from("audit_logs").insert({
    actor_user_id: ctx.userId,
    action: "payout_method_disable",
    entity_type: "payout_method",
    entity_id: methodId,
    metadata: { country_code: method.country_code, currency: method.currency },
  });
  await queueMethodSecurityMessage({
    userId: ctx.userId,
    payoutMethodId: methodId,
    event: "disabled",
    countryCode: method.country_code,
    currency: method.currency ? String(method.currency).trim() : null,
    methodName: method.method_type,
    destinationMask: method.destination_mask || "Secure destination",
  });

  revalidatePayoutViews();
  return { ok: true, data: true };
}
