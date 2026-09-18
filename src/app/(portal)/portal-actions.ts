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
  const { data, error } = await supabase
    .from("portal_service_requests")
    .insert({
      owner_user_id: ctx.userId,
      kind: parsed.kind,
      title: parsed.title,
      body: parsed.body,
      related_url: parsed.url,
      release_id: input.release_id || null,
      status: "submitted",
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
  primary_artist_name?: string;
  genre?: string;
  language?: string;
  release_date?: string;
  video_type?: string;
  age_restriction?: string;
  is_cover_version?: boolean;
  reference_upc?: string;
  reference_isrc?: string;
  deliver_apple_music?: boolean;
  deliver_vevo?: boolean;
  confirm_rights?: boolean;
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

  type LinkedRelease = {
    id: string;
    primary_artist_name: string;
    label_name: string | null;
    genre: string | null;
    language: string | null;
    release_date: string | null;
    distribution_settings: Record<string, unknown> | null;
  };

  let linkedRelease: LinkedRelease | null = null;

  if (input.release_id) {
    const { data: release } = await supabase
      .from("releases")
      .select("id, primary_artist_name, label_name, genre, language, release_date, distribution_settings")
      .eq("id", input.release_id)
      .eq("owner_user_id", ctx.userId)
      .maybeSingle();
    if (!release) return { ok: false, error: "Linked release was not found on this account." };
    linkedRelease = release as LinkedRelease;
  }

  const primaryArtistName =
    linkedRelease?.primary_artist_name?.trim() || parsed.primaryArtistName;
  if (!primaryArtistName) {
    return { ok: false, error: "Primary artist is required for music-video distribution." };
  }

  const linkedSettings = linkedRelease?.distribution_settings ?? {};
  const { data, error } = await supabase
    .from("music_video_submissions")
    .insert({
      owner_user_id: ctx.userId,
      title: parsed.title,
      video_url: parsed.url,
      notes: parsed.notes,
      release_id: linkedRelease?.id ?? null,
      primary_artist_name: primaryArtistName,
      label_name: linkedRelease?.label_name ?? null,
      genre: parsed.genre ?? linkedRelease?.genre ?? null,
      language: parsed.language ?? linkedRelease?.language ?? null,
      release_date: parsed.releaseDate ?? linkedRelease?.release_date ?? null,
      video_type: parsed.videoType,
      age_restriction: parsed.ageRestriction,
      is_cover_version: parsed.isCoverVersion,
      reference_upc: parsed.referenceUpc,
      reference_isrc: parsed.referenceIsrc,
      deliver_apple_music: parsed.deliverAppleMusic,
      deliver_vevo: parsed.deliverVevo,
      distribution_settings: {
        providerArtistId:
          typeof linkedSettings.providerArtistId === "string" ||
          typeof linkedSettings.providerArtistId === "number"
            ? linkedSettings.providerArtistId
            : null,
        rightsConfirmed: true,
      },
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
  const rl = checkRateLimit({ key: `splitshare:payee:${ctx.userId}`, ...RATE_LIMITS.portalRequest });
  if (!rl.ok) return { ok: false, error: "Too many payee requests. Try again later." };
  const parsed = validatePayeeInput(input);
  if (!parsed.ok) return parsed;

  const supabase = await createClient();
  const { data: existing, error: existingError } = await supabase
    .from("portal_payees")
    .select("id, status")
    .eq("owner_user_id", ctx.userId)
    .ilike("email", parsed.email)
    .maybeSingle();

  if (existingError) return { ok: false, error: publicErrorMessage(existingError.message) };

  if (existing) {
    if (existing.status === "approved") {
      return { ok: false, error: "This payee is already approved on your account." };
    }
    if (existing.status === "submitted") {
      return { ok: false, error: "This payee is already awaiting admin review." };
    }

    const { data, error } = await supabase
      .from("portal_payees")
      .update({
        name: parsed.name,
        role_label: parsed.role_label,
        status: "submitted",
        admin_note: null,
        reviewed_by: null,
        reviewed_at: null,
        linked_user_id: null,
      })
      .eq("id", existing.id)
      .eq("owner_user_id", ctx.userId)
      .in("status", ["rejected", "disabled"])
      .select("id")
      .single();

    if (error) return { ok: false, error: publicErrorMessage(error.message) };
    revalidatePath("/splitshare/payees");
    revalidatePath("/admin/splitshare");
    return { ok: true, data: { id: data.id } };
  }

  const { data, error } = await supabase
    .from("portal_payees")
    .insert({
      owner_user_id: ctx.userId,
      name: parsed.name,
      email: parsed.email,
      role_label: parsed.role_label,
      status: "submitted",
      admin_note: null,
      reviewed_by: null,
      reviewed_at: null,
    })
    .select("id")
    .single();

  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return { ok: false, error: "This payee email already exists on your account." };
    }
    return { ok: false, error: publicErrorMessage(error.message) };
  }

  revalidatePath("/splitshare/payees");
  revalidatePath("/admin/splitshare");
  return { ok: true, data: { id: data.id } };
}

export async function createSplitRuleAction(input: {
  name: string;
  shares: SplitShareInput[];
  effectiveFrom?: string;
}): Promise<PortalActionResult<{ id: string }>> {
  const ctx = await requirePortal();
  const rl = checkRateLimit({ key: `splitshare:rule:${ctx.userId}`, ...RATE_LIMITS.portalRequest });
  if (!rl.ok) return { ok: false, error: "Too many split requests. Try again later." };
  const parsed = validateSplitCreateInput(input);
  if (!parsed.ok) return parsed;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_splitshare_rule", {
    p_name: parsed.name,
    p_effective_from: parsed.effectiveFrom,
    p_shares: parsed.shares.map((share) => ({
      payee_id: share.payeeId,
      share_bps: share.shareBps,
    })),
  });
  if (error) return { ok: false, error: publicErrorMessage(error.message) };
  revalidatePath("/earnings/splits");
  revalidatePath("/splitshare/assignments");
  revalidatePath("/admin/splitshare");
  return { ok: true, data: { id: String(data) } };
}

export async function assignSplitToTrackAction(input: {
  track_id: string;
  split_rule_id: string;
}): Promise<PortalActionResult<{ id: string }>> {
  const ctx = await requirePortal();
  const rl = checkRateLimit({ key: `splitshare:assignment:${ctx.userId}`, ...RATE_LIMITS.portalRequest });
  if (!rl.ok) return { ok: false, error: "Too many assignment requests. Try again later." };
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
    .select("id, review_status")
    .eq("id", input.split_rule_id)
    .eq("owner_user_id", ctx.userId)
    .eq("review_status", "approved")
    .eq("is_active", true)
    .maybeSingle();
  if (!rule) return { ok: false, error: "Select an approved active split rule." };
  const { data, error } = await supabase
    .from("split_track_assignments")
    .upsert(
      {
        owner_user_id: ctx.userId,
        track_id: input.track_id,
        split_rule_id: input.split_rule_id,
        status: "submitted",
        admin_note: null,
        reviewed_by: null,
        reviewed_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "track_id" }
    )
    .select("id")
    .single();
  if (error) return { ok: false, error: publicErrorMessage(error.message) };
  revalidatePath("/splitshare/assignments");
  revalidatePath("/admin/splitshare");
  return { ok: true, data: { id: data.id } };
}

export async function createRecoupmentAction(input: {
  title: string;
  amountMinor: number;
  currency?: string;
  notes?: string;
  payee_id: string;
  track_id?: string;
}): Promise<PortalActionResult<{ id: string }>> {
  const ctx = await requirePortal();
  const rl = checkRateLimit({ key: `splitshare:recoupment:${ctx.userId}`, ...RATE_LIMITS.portalRequest });
  if (!rl.ok) return { ok: false, error: "Too many recoupment requests. Try again later." };
  const parsed = validateRecoupmentInput(input);
  if (!parsed.ok) return parsed;
  if (!/^[0-9a-f-]{36}$/i.test(input.payee_id)) return { ok: false, error: "Select an approved payee." };
  const supabase = await createClient();
  const { data: payee } = await supabase
    .from("portal_payees")
    .select("id")
    .eq("id", input.payee_id)
    .eq("owner_user_id", ctx.userId)
    .eq("status", "approved")
    .maybeSingle();
  if (!payee) return { ok: false, error: "Select an approved payee." };

  let trackId: string | null = null;
  if (input.track_id) {
    const { data: track } = await supabase
      .from("release_tracks")
      .select("id, releases!inner(owner_user_id)")
      .eq("id", input.track_id)
      .eq("releases.owner_user_id", ctx.userId)
      .maybeSingle();
    if (!track) return { ok: false, error: "Track not found." };
    trackId = track.id;
  }

  const { data, error } = await supabase
    .from("portal_recoupments")
    .insert({
      owner_user_id: ctx.userId,
      title: parsed.title,
      amount_minor: parsed.amountMinor,
      currency: parsed.currency,
      notes: input.notes?.trim() || null,
      payee_id: input.payee_id,
      track_id: trackId,
      recovered_minor: 0,
      status: "submitted",
      admin_note: null,
      reviewed_by: null,
      reviewed_at: null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: publicErrorMessage(error.message) };
  revalidatePath("/splitshare/recoupments");
  revalidatePath("/admin/splitshare");
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
