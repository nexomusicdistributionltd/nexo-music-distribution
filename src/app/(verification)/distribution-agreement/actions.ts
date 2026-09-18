"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { RequireRole } from "@/lib/auth/guards";
import { getEntitlementsForAuth } from "@/lib/billing/queries";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  buildExecutedAgreementPdf,
  DISTRIBUTION_AGREEMENT_VERSION,
  legalNameMatches,
} from "@/lib/legal/distribution-agreement";
import { queueAgreementSignedEmail } from "@/lib/email/identity-agreement";

type SignInput = {
  legalName: string;
  signatureMethod: "typed" | "drawn";
  drawnSignatureDataUrl?: string | null;
  declarationsAccepted: boolean;
};

function decodeDrawnSignature(dataUrl: string): { bytes: Buffer; contentType: string; ext: string } {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl.trim());
  if (!match) throw new Error("Drawn signature must be captured in the signing form.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length < 100 || bytes.length > 2 * 1024 * 1024) {
    throw new Error("Drawn signature image is invalid or too large.");
  }
  const format = match[1];
  return {
    bytes,
    contentType: format === "jpeg" ? "image/jpeg" : `image/${format}`,
    ext: format === "jpeg" ? "jpg" : format,
  };
}

export async function signDistributionAgreementAction(
  input: SignInput
): Promise<{ ok: true; agreementId: string } | { ok: false; error: string }> {
  const ctx = await RequireRole(["artist", "label"], { allowUnsignedAgreement: true });
  if (!input.declarationsAccepted) {
    return { ok: false, error: "You must accept all agreement declarations before signing." };
  }
  if (input.signatureMethod !== "typed" && input.signatureMethod !== "drawn") {
    return { ok: false, error: "Choose a valid signature method." };
  }

  const service = createServiceClient();
  const { data: verification, error: verificationError } = await service
    .from("identity_verifications")
    .select("id,user_id,account_type,country_code,legal_name,legal_full_name,status,verified_at")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (verificationError || !verification || verification.status !== "verified" || !verification.verified_at) {
    return { ok: false, error: "Approved identity verification is required before signing." };
  }

  const verifiedLegalName = String(verification.legal_name || verification.legal_full_name || "").trim();
  if (!verifiedLegalName || !legalNameMatches(input.legalName, verifiedLegalName)) {
    return {
      ok: false,
      error: "The signing name must exactly match the legal name on your approved verification.",
    };
  }

  const { data: existing } = await service
    .from("distribution_agreements")
    .select("id,status")
    .eq("user_id", ctx.userId)
    .eq("agreement_version", DISTRIBUTION_AGREEMENT_VERSION)
    .eq("status", "signed")
    .maybeSingle();
  if (existing) return { ok: true, agreementId: existing.id };

  let drawn: ReturnType<typeof decodeDrawnSignature> | null = null;
  if (input.signatureMethod === "drawn") {
    try {
      drawn = decodeDrawnSignature(input.drawnSignatureDataUrl ?? "");
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Invalid signature." };
    }
  }

  const accountType: "artist" | "label" = ctx.roles.includes("label") ? "label" : "artist";
  const [{ data: artist }, { data: label }] = await Promise.all([
    service
      .from("artist_profiles")
      .select("artist_name,stage_name")
      .eq("user_id", ctx.userId)
      .maybeSingle(),
    service
      .from("label_profiles")
      .select("label_name,legal_business_name")
      .eq("user_id", ctx.userId)
      .maybeSingle(),
  ]);
  const displayName =
    accountType === "label"
      ? String(label?.label_name || label?.legal_business_name || ctx.profile?.display_name || verifiedLegalName)
      : String(artist?.artist_name || artist?.stage_name || ctx.profile?.display_name || verifiedLegalName);

  const entitlements = await getEntitlementsForAuth(ctx);
  const commissionBps: 1000 | 2000 = entitlements.paidAccess ? 1000 : 2000;
  const agreementId = crypto.randomUUID();
  const signedAt = new Date().toISOString();
  const nexoExecutedAt = signedAt;
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const realIp = requestHeaders.get("x-real-ip")?.trim() || null;
  const signerIp = forwarded || realIp;
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 1000) || null;

  const execution = {
    agreementId,
    userId: ctx.userId,
    verificationId: verification.id,
    accountType,
    legalName: verifiedLegalName,
    displayName,
    email: ctx.email,
    countryCode: verification.country_code,
    planId: entitlements.planId,
    commissionBps,
    signatureMethod: input.signatureMethod,
    signedAt,
    verificationApprovedAt: verification.verified_at,
    nexoExecutedAt,
    signerIp,
    userAgent,
  } as const;

  let built;
  try {
    built = buildExecutedAgreementPdf(execution);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Agreement execution is unavailable.",
    };
  }

  const root = `${ctx.userId}/${agreementId}`;
  let signaturePath: string | null = null;
  if (drawn) {
    signaturePath = `${root}/client-signature.${drawn.ext}`;
    const { error } = await service.storage
      .from("distribution-agreements")
      .upload(signaturePath, drawn.bytes, {
        contentType: drawn.contentType,
        upsert: false,
      });
    if (error) return { ok: false, error: "Could not store the drawn signature." };
  }

  const pdfPath = `${root}/Nexo-Distribution-Agreement-v${DISTRIBUTION_AGREEMENT_VERSION}.pdf`;
  const { error: pdfError } = await service.storage
    .from("distribution-agreements")
    .upload(pdfPath, built.pdf, { contentType: "application/pdf", upsert: false });
  if (pdfError) {
    if (signaturePath) await service.storage.from("distribution-agreements").remove([signaturePath]);
    return { ok: false, error: "Could not seal the signed agreement document." };
  }

  const { error: insertError } = await service.from("distribution_agreements").insert({
    id: agreementId,
    user_id: ctx.userId,
    verification_id: verification.id,
    account_type: accountType,
    agreement_version: DISTRIBUTION_AGREEMENT_VERSION,
    legal_name: verifiedLegalName,
    display_name: displayName,
    verified_email: ctx.email,
    country_code: verification.country_code,
    plan_id: entitlements.planId,
    commission_bps: commissionBps,
    signature_method: input.signatureMethod,
    typed_signature: verifiedLegalName,
    signature_path: signaturePath,
    pdf_path: pdfPath,
    acceptance_flags: {
      legal_name_match: true,
      agreement_accepted: true,
      distribution_rights_confirmed: true,
      artificial_streaming_terms_accepted: true,
      commission_terms_accepted: true,
      electronic_signature_consent: true,
    },
    verification_approved_at: verification.verified_at,
    signed_at: signedAt,
    nexo_executed_at: nexoExecutedAt,
    nexo_execution_seal: built.executionSeal,
    signer_ip: signerIp,
    user_agent: userAgent,
    document_sha256: built.sha256,
    status: "signed",
  });

  if (insertError) {
    await service.storage
      .from("distribution-agreements")
      .remove([pdfPath, ...(signaturePath ? [signaturePath] : [])]);
    return { ok: false, error: "Could not save the signed agreement record." };
  }

  await Promise.all([
    service
      .from("profiles")
      .update({
        distribution_agreement_id: agreementId,
        distribution_agreement_signed_at: signedAt,
      })
      .eq("id", ctx.userId),
    service.from("notifications").insert({
      user_id: ctx.userId,
      type: "agreement_update",
      title: "Distribution agreement signed",
      body: "Your Nexo Music Distribution agreement has been executed and is available in your account.",
      entity_type: "distribution_agreement",
      entity_id: agreementId,
      action_path: `/distribution-agreement?agreement=${agreementId}`,
    }),
  ]);

  await queueAgreementSignedEmail({
    supabase: service,
    userId: ctx.userId,
    agreementId,
    legalName: verifiedLegalName,
  });

  revalidatePath("/distribution-agreement");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/releases");
  revalidatePath("/admin/users");
  return { ok: true, agreementId };
}
