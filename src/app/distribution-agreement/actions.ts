"use server";

import { createHash, randomUUID } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { RequireVerifiedPortal } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/admin";
import { safeGetEntitlementsForAuth } from "@/lib/billing/queries";
import {
  AGREEMENT_DECLARATIONS,
  DISTRIBUTION_AGREEMENT_VERSION,
  normalizeAgreementLegalName,
  renderSignedAgreementHtml,
} from "@/lib/legal/distribution-agreement";

export type AgreementSignResult =
  | { ok: true; data: { id: string } }
  | { ok: false; error: string };

function signatureBuffer(dataUrl: string): Buffer | null {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  const buf = Buffer.from(match[1], "base64");
  if (buf.length < 100 || buf.length > 1024 * 1024) return null;
  return buf;
}

export async function signDistributionAgreementAction(input: {
  legalName: string;
  declarationsAccepted: boolean[];
  signatureMethod: "typed" | "drawn";
  typedSignature?: string;
  drawnSignatureDataUrl?: string;
}): Promise<AgreementSignResult> {
  const ctx = await RequireVerifiedPortal();
  const service = createServiceClient();

  const { data: verification, error: verificationError } = await service
    .from("identity_verifications")
    .select("id, account_type, country_code, legal_name, status, verified_at")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (verificationError || !verification || verification.status !== "verified" || !verification.verified_at) {
    return { ok: false, error: "Identity verification must be approved before signing." };
  }

  const suppliedLegal = input.legalName.trim().replace(/\s+/g, " ");
  if (
    !suppliedLegal ||
    normalizeAgreementLegalName(suppliedLegal) !==
      normalizeAgreementLegalName(String(verification.legal_name))
  ) {
    return {
      ok: false,
      error: "Full legal name must match the approved identity verification exactly.",
    };
  }

  if (
    input.declarationsAccepted.length !== AGREEMENT_DECLARATIONS.length ||
    input.declarationsAccepted.some((accepted) => accepted !== true)
  ) {
    return { ok: false, error: "Every agreement declaration must be accepted." };
  }

  const { data: existing } = await service
    .from("distribution_agreement_executions")
    .select("id")
    .eq("user_id", ctx.userId)
    .eq("agreement_version", DISTRIBUTION_AGREEMENT_VERSION)
    .eq("status", "signed")
    .maybeSingle();
  if (existing?.id) return { ok: true, data: { id: existing.id } };

  const { data: companyAuthorization, error: authError } = await service
    .from("distribution_agreement_company_authorizations")
    .select("id, authorized_legal_name, authorized_title, authorized_at")
    .eq("agreement_version", DISTRIBUTION_AGREEMENT_VERSION)
    .eq("is_active", true)
    .maybeSingle();
  if (authError || !companyAuthorization) {
    return {
      ok: false,
      error: "Nexo company authorization for this agreement version is not active.",
    };
  }

  const { data: profile } = await service
    .from("profiles")
    .select("email, display_name, full_name")
    .eq("id", ctx.userId)
    .maybeSingle();
  const email = profile?.email || ctx.email;
  if (!email) return { ok: false, error: "Verified account email is missing." };

  let displayName = profile?.display_name || profile?.full_name || null;
  if (verification.account_type === "label") {
    const { data: label } = await service
      .from("label_profiles")
      .select("label_name")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    displayName = label?.label_name || displayName;
  } else {
    const { data: artist } = await service
      .from("artist_profiles")
      .select("artist_name, stage_name")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    displayName = artist?.artist_name || artist?.stage_name || displayName;
  }

  const entitlements = await safeGetEntitlementsForAuth(ctx);
  const paidPlan = Boolean(entitlements.paidAccess);
  const commissionBps = (paidPlan ? 1000 : 2000) as 1000 | 2000;
  const signedAt = new Date().toISOString();
  const agreementId = randomUUID();

  let signatureText: string | null = null;
  let signatureStoragePath: string | null = null;
  let signatureDataUrl: string | null = null;
  let signatureDigest: string;

  if (input.signatureMethod === "typed") {
    const typed = (input.typedSignature ?? "").trim().replace(/\s+/g, " ");
    if (
      !typed ||
      normalizeAgreementLegalName(typed) !==
        normalizeAgreementLegalName(String(verification.legal_name))
    ) {
      return {
        ok: false,
        error: "Typed signature must be the same full legal name as the approved verification.",
      };
    }
    signatureText = typed;
    signatureDigest = createHash("sha256").update(typed, "utf8").digest("hex");
  } else {
    const raw = signatureBuffer(input.drawnSignatureDataUrl ?? "");
    if (!raw) {
      return { ok: false, error: "Draw a valid live signature before signing." };
    }
    signatureStoragePath = `${ctx.userId}/${agreementId}/client-signature.png`;
    const { error: uploadError } = await service.storage
      .from("distribution-agreements")
      .upload(signatureStoragePath, raw, {
        contentType: "image/png",
        upsert: false,
      });
    if (uploadError) {
      return { ok: false, error: "Could not securely store the signature." };
    }
    signatureDataUrl = `data:image/png;base64,${raw.toString("base64")}`;
    signatureDigest = createHash("sha256").update(raw).digest("hex");
  }

  const requestHeaders = await headers();
  const clientIp =
    requestHeaders.get("x-nf-client-connection-ip") ||
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null;
  const userAgent = requestHeaders.get("user-agent") || null;

  const canonicalRecord = JSON.stringify({
    agreementId,
    agreementVersion: DISTRIBUTION_AGREEMENT_VERSION,
    userId: ctx.userId,
    verificationId: verification.id,
    legalName: verification.legal_name,
    accountType: verification.account_type,
    verifiedAt: verification.verified_at,
    signedAt,
    email,
    countryCode: verification.country_code,
    planId: entitlements.planId,
    paidPlan,
    commissionBps,
    declarations: AGREEMENT_DECLARATIONS,
    signatureMethod: input.signatureMethod,
    signatureDigest,
    companyAuthorizationId: companyAuthorization.id,
    companyAuthorizedAt: companyAuthorization.authorized_at,
  });
  const executionHash = createHash("sha256").update(canonicalRecord, "utf8").digest("hex");

  const documentHtml = renderSignedAgreementHtml({
    agreementId,
    accountType: verification.account_type as "artist" | "label",
    legalName: String(verification.legal_name),
    displayName,
    accountId: ctx.userId,
    verificationId: verification.id,
    verifiedEmail: email,
    countryCode: String(verification.country_code),
    paidPlan,
    planId: entitlements.planId,
    commissionBps,
    clientSignedAt: signedAt,
    verificationApprovedAt: verification.verified_at,
    companyAuthorizedAt: companyAuthorization.authorized_at,
    companyAuthorizedName: companyAuthorization.authorized_legal_name,
    companyAuthorizedTitle: companyAuthorization.authorized_title,
    signatureMethod: input.signatureMethod,
    signatureText,
    signatureDataUrl,
    userAgent,
    clientIp,
    executionHash,
  });

  const { error: insertError } = await service
    .from("distribution_agreement_executions")
    .insert({
      id: agreementId,
      user_id: ctx.userId,
      verification_id: verification.id,
      company_authorization_id: companyAuthorization.id,
      agreement_version: DISTRIBUTION_AGREEMENT_VERSION,
      account_type: verification.account_type,
      legal_name: verification.legal_name,
      display_name: displayName,
      verified_email: email,
      country_code: verification.country_code,
      plan_id: entitlements.planId,
      commission_bps: commissionBps,
      declarations: AGREEMENT_DECLARATIONS,
      signature_method: input.signatureMethod,
      signature_text: signatureText,
      signature_storage_path: signatureStoragePath,
      client_ip: clientIp,
      user_agent: userAgent,
      verification_approved_at: verification.verified_at,
      client_signed_at: signedAt,
      document_html: documentHtml,
      document_sha256: executionHash,
      status: "signed",
    });
  if (insertError) {
    if (signatureStoragePath) {
      await service.storage.from("distribution-agreements").remove([signatureStoragePath]);
    }
    if (/duplicate|unique/i.test(insertError.message)) {
      const { data: row } = await service
        .from("distribution_agreement_executions")
        .select("id")
        .eq("user_id", ctx.userId)
        .eq("agreement_version", DISTRIBUTION_AGREEMENT_VERSION)
        .eq("status", "signed")
        .maybeSingle();
      if (row?.id) return { ok: true, data: { id: row.id } };
    }
    return { ok: false, error: "Could not save the signed agreement." };
  }

  await service
    .from("profiles")
    .update({
      distribution_agreement_signed_at: signedAt,
      distribution_agreement_id: agreementId,
      updated_at: signedAt,
    })
    .eq("id", ctx.userId);

  await service.from("notifications").insert({
    user_id: ctx.userId,
    type: "agreement_update",
    title: "Distribution agreement signed",
    body: `Your Nexo Music Distribution Agreement ${DISTRIBUTION_AGREEMENT_VERSION} was signed and stored successfully.`,
    entity_type: "distribution_agreement",
    entity_id: agreementId,
  });

  revalidatePath("/distribution-agreement");
  revalidatePath("/dashboard");
  return { ok: true, data: { id: agreementId } };
}
