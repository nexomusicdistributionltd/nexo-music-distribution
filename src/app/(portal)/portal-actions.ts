"use server";

import { revalidatePath } from "next/cache";
import { RequireVerifiedPortal, assertCanMutateCatalog } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { publicErrorMessage } from "@/lib/http/safe-error";
import { RATE_LIMITS, checkRateLimit } from "@/lib/security/rate-limit";
import {
  validateMemberInput,
  validatePayeeInput,
  validatePayoutRequestInput,
  validateRecoupmentInput,
  validateServiceRequestInput,
  validateSplitCreateInput,
  validateTaxInput,
  validateVideoInput,
} from "@/lib/portal/validate";
import type { SplitShareInput } from "@/lib/finance/splits";
import { createServiceClient } from "@/lib/supabase/admin";
import { marketingServiceSpec } from "@/lib/marketing/services";

export type PortalActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function requirePortal() {
  return RequireVerifiedPortal();
}

function revalidatePortal() {
  revalidatePath("/dashboard");
  revalidatePath("/catalog", "layout");
  revalidatePath("/marketing", "layout");
  revalidatePath("/analytics", "layout");
  revalidatePath("/rights", "layout");
  revalidatePath("/help", "layout");
  revalidatePath("/splitshare", "layout");
  revalidatePath("/account", "layout");
  revalidatePath("/earnings", "layout");
  revalidatePath("/dashboard/videos");
  revalidatePath("/admin/marketing");
}

export async function createServiceRequestAction(input: {
  kind: string;
  title: string;
  body?: string;
  related_url?: string;
  release_id?: string;
}): Promise<PortalActionResult<{ id: string }>> {
  const ctx = await requirePortal();
  try {
    assertCanMutateCatalog(ctx);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restricted." };
  }
  const rl = checkRateLimit({ key: `portal:svc:${ctx.userId}`, ...RATE_LIMITS.portalRequest });
  if (!rl.ok) return { ok: false, error: "Too many requests. Try again later." };
  const parsed = validateServiceRequestInput(input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const spec = marketingServiceSpec(parsed.kind);
  let requiresRelease = Boolean(spec?.requiresRelease);

  if (spec) {
    const { data: control, error: controlError } = await supabase
      .from("marketing_service_controls")
      .select("enabled, accepting_requests, requires_release")
      .eq("kind", parsed.kind)
      .maybeSingle();

    if (controlError) {
      return { ok: false, error: "Marketing controls are unavailable. Try again after the latest database migration is applied." };
    }
    if (control && (!control.enabled || !control.accepting_requests)) {
      return { ok: false, error: "This marketing service is not accepting new requests right now." };
    }
    requiresRelease = Boolean(control?.requires_release ?? requiresRelease);
  }

  const releaseId = input.release_id?.trim() || null;
  let ownedRelease: { id: string; title: string | null; release_date: string | null } | null = null;

  if (releaseId) {
    const { data: release, error: releaseError } = await supabase
      .from("releases")
      .select("id, title, release_date")
      .eq("id", releaseId)
      .eq("owner_user_id", ctx.userId)
      .maybeSingle();

    if (releaseError || !release) {
      return { ok: false, error: "Select a release from your own Nexo catalog." };
    }
    ownedRelease = release;
  }

  if (requiresRelease && !ownedRelease) {
    return { ok: false, error: "Select the release this marketing request is for." };
  }

  if (spec?.providerMode === "toolost_manual" && ownedRelease) {
    const service = createServiceClient();
    const { data: providerLink } = await service
      .from("provider_release_links")
      .select("provider_release_id, provider_status")
      .eq("release_id", ownedRelease.id)
      .eq("provider_name", "distribution_engine")
      .maybeSingle();

    const providerRequiredKinds = new Set([
      "dsp_pitching",
      "priority_pitch",
      "spotify_discovery_mode",
      "luminate",
    ]);
    if (providerRequiredKinds.has(parsed.kind) && !providerLink?.provider_release_id) {
      return {
        ok: false,
        error:
          "This service requires a release that has already been created with the connected distribution provider.",
      };
    }

    if (parsed.kind === "priority_pitch" && ownedRelease.release_date) {
      const releaseDate = new Date(`${ownedRelease.release_date}T00:00:00Z`);
      if (!Number.isNaN(releaseDate.getTime()) && releaseDate.getTime() <= Date.now()) {
        return {
          ok: false,
          error: "Priority Pitch is only available for an upcoming release that has not been released yet.",
        };
      }
    }
  }

  if (spec && ownedRelease) {
    const activeStatuses = ["submitted", "reviewing", "needs_info", "accepted", "approved", "processing", "live"];
    const { data: duplicate } = await supabase
      .from("portal_service_requests")
      .select("id")
      .eq("owner_user_id", ctx.userId)
      .eq("kind", parsed.kind)
      .eq("release_id", ownedRelease.id)
      .in("status", activeStatuses)
      .limit(1)
      .maybeSingle();

    if (duplicate) {
      return { ok: false, error: "An active request already exists for this release and service." };
    }
  }

  const { data, error } = await supabase
    .from("portal_service_requests")
    .insert({
      owner_user_id: ctx.userId,
      kind: parsed.kind,
      title: parsed.title,
      body: parsed.body,
      related_url: parsed.url,
      release_id: ownedRelease?.id ?? null,
      status: "submitted",
      submitted_payload: spec
        ? {
            source: "nexo_portal",
            provider_mode: spec.providerMode,
            provider_feature: spec.providerFeature ?? null,
            recommended_lead_days: spec.recommendedLeadDays ?? null,
            submitted_at: new Date().toISOString(),
          }
        : {},
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: publicErrorMessage(error.message) };
  revalidatePortal();
  return { ok: true, data: { id: data.id } };
}

export async function createMusicVideoAction(input: {
  title: string;
  video_url: string;
  notes?: string;
  release_id?: string;
}): Promise<PortalActionResult<{ id: string }>> {
  const ctx = await requirePortal();
  try {
    assertCanMutateCatalog(ctx);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restricted." };
  }
  const rl = checkRateLimit({ key: `portal:video:${ctx.userId}`, ...RATE_LIMITS.portalRequest });
  if (!rl.ok) return { ok: false, error: "Too many requests. Try again later." };
  const parsed = validateVideoInput(input);
  if (!parsed.ok) return parsed;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("music_video_submissions")
    .insert({
      owner_user_id: ctx.userId,
      title: parsed.title,
      video_url: parsed.url,
      notes: parsed.notes,
      release_id: input.release_id || null,
      status: "submitted",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: publicErrorMessage(error.message) };
  revalidatePath("/dashboard/videos");
  return { ok: true, data: { id: data.id } };
}

export async function createPayeeAction(input: {
  name: string;
  email?: string;
  role_label?: string;
}): Promise<PortalActionResult<{ id: string }>> {
  const ctx = await requirePortal();
  const parsed = validatePayeeInput(input);
  if (!parsed.ok) return parsed;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portal_payees")
    .insert({
      owner_user_id: ctx.userId,
      name: parsed.name,
      email: parsed.email,
      role_label: parsed.role_label,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: publicErrorMessage(error.message) };
  revalidatePath("/splitshare/payees");
  return { ok: true, data: { id: data.id } };
}

export async function createSplitRuleAction(input: {
  name: string;
  shares: SplitShareInput[];
  effectiveFrom?: string;
}): Promise<PortalActionResult<{ id: string }>> {
  const ctx = await requirePortal();
  const parsed = validateSplitCreateInput(input);
  if (!parsed.ok) return parsed;
  const supabase = await createClient();
  const { data: rule, error } = await supabase
    .from("royalty_split_rules")
    .insert({
      owner_user_id: ctx.userId,
      name: parsed.name,
      scope_type: "account",
      effective_from: parsed.effectiveFrom,
      is_active: true,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: publicErrorMessage(error.message) };
  const { error: shareError } = await supabase.from("royalty_split_shares").insert(
    parsed.shares.map((s) => ({
      rule_id: rule.id,
      party_name: s.partyName.trim(),
      party_role: s.partyRole,
      share_bps: s.shareBps,
      party_user_id: s.partyUserId ?? null,
    }))
  );
  if (shareError) return { ok: false, error: publicErrorMessage(shareError.message) };
  revalidatePath("/earnings/splits");
  return { ok: true, data: { id: rule.id } };
}

export async function assignSplitToTrackAction(input: {
  track_id: string;
  split_rule_id: string;
}): Promise<PortalActionResult<{ id: string }>> {
  const ctx = await requirePortal();
  if (!input.track_id || !input.split_rule_id) return { ok: false, error: "Track and split are required." };
  const supabase = await createClient();
  const { data: track } = await supabase
    .from("release_tracks")
    .select("id, releases!inner(owner_user_id)")
    .eq("id", input.track_id)
    .eq("releases.owner_user_id", ctx.userId)
    .maybeSingle();
  if (!track) return { ok: false, error: "Track not found." };
  const { data: rule } = await supabase
    .from("royalty_split_rules")
    .select("id")
    .eq("id", input.split_rule_id)
    .eq("owner_user_id", ctx.userId)
    .maybeSingle();
  if (!rule) return { ok: false, error: "Split rule not found." };
  const { data, error } = await supabase
    .from("split_track_assignments")
    .upsert(
      {
        owner_user_id: ctx.userId,
        track_id: input.track_id,
        split_rule_id: input.split_rule_id,
      },
      { onConflict: "track_id" }
    )
    .select("id")
    .single();
  if (error) return { ok: false, error: publicErrorMessage(error.message) };
  revalidatePath("/splitshare/assignments");
  return { ok: true, data: { id: data.id } };
}

export async function createRecoupmentAction(input: {
  title: string;
  amountMinor: number;
  currency?: string;
  notes?: string;
}): Promise<PortalActionResult<{ id: string }>> {
  const ctx = await requirePortal();
  const parsed = validateRecoupmentInput(input);
  if (!parsed.ok) return parsed;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portal_recoupments")
    .insert({
      owner_user_id: ctx.userId,
      title: parsed.title,
      amount_minor: parsed.amountMinor,
      currency: parsed.currency,
      notes: input.notes?.trim() || null,
      status: "open",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: publicErrorMessage(error.message) };
  revalidatePath("/splitshare/recoupments");
  return { ok: true, data: { id: data.id } };
}

export async function inviteAccountMemberAction(input: {
  email: string;
  display_name?: string;
  role_label?: string;
}): Promise<PortalActionResult<{ id: string }>> {
  const ctx = await requirePortal();
  if (!ctx.roles.includes("label")) {
    return { ok: false, error: "Account members are managed on label accounts." };
  }
  const parsed = validateMemberInput(input);
  if (!parsed.ok) return parsed;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("account_members")
    .insert({
      owner_user_id: ctx.userId,
      email: parsed.email,
      display_name: parsed.display_name,
      role_label: parsed.role_label,
      status: "invited",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: publicErrorMessage(error.message) };
  revalidatePath("/account/members");
  return { ok: true, data: { id: data.id } };
}

export async function saveTaxDetailsAction(input: {
  legal_name?: string;
  country?: string;
  tax_id?: string;
}): Promise<PortalActionResult> {
  const ctx = await requirePortal();
  const parsed = validateTaxInput(input);
  if (!parsed.ok) return parsed;
  const supabase = await createClient();
  const { error } = await supabase.from("account_tax_details").upsert({
    owner_user_id: ctx.userId,
    legal_name: parsed.legal_name,
    country: parsed.country,
    tax_id: parsed.tax_id,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: publicErrorMessage(error.message) };
  revalidatePath("/account/payment-tax");
  return { ok: true, data: true };
}

export async function requestEnrollmentAction(service_key: string): Promise<PortalActionResult> {
  const ctx = await requirePortal();
  const key = service_key.trim().slice(0, 80);
  if (!key) return { ok: false, error: "Service required." };
  const supabase = await createClient();
  const { error } = await supabase.from("account_enrollments").insert({
    owner_user_id: ctx.userId,
    service_key: key,
    status: "requested",
  });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { ok: true, data: true };
    return { ok: false, error: publicErrorMessage(error.message) };
  }
  revalidatePath("/account/enrollments");
  return { ok: true, data: true };
}

export async function createPayoutRequestAction(input: {
  amountMinor: number;
  currency?: string;
  payoutMethodId: string;
}): Promise<PortalActionResult<{ id: string }>> {
  const ctx = await requirePortal();
  const rl = checkRateLimit({
    key: `payout:req:${ctx.userId}`,
    ...RATE_LIMITS.payoutCreate,
  });
  if (!rl.ok) return { ok: false, error: "Too many payout requests." };

  const parsed = validatePayoutRequestInput({
    amountMinor: input.amountMinor,
    currency: input.currency,
  });
  if (!parsed.ok) return parsed;

  const payoutMethodId = input.payoutMethodId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(payoutMethodId)) {
    return { ok: false, error: "Select an approved payout method." };
  }

  const supabase = await createClient();
  const idempotencyKey =
    `portal:${ctx.userId}:${parsed.currency}:${parsed.amountMinor}:${payoutMethodId}:${Date.now()}`;

  const { data, error } = await supabase.rpc("create_payout_request_with_method", {
    p_owner_user_id: ctx.userId,
    p_amount_minor: parsed.amountMinor,
    p_currency: parsed.currency,
    p_payout_method_id: payoutMethodId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) return { ok: false, error: publicErrorMessage(error.message) };

  revalidatePath("/earnings/payouts");
  revalidatePath("/earnings");
  return { ok: true, data: { id: data.id } };
}
