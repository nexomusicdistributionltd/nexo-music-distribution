"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { RequireRole } from "@/lib/auth/guards";
import { createServiceClient } from "@/lib/supabase/admin";
import { safeGetEntitlementsForAuth } from "@/lib/billing/queries";
import { enqueueEmailEvent } from "@/lib/email/enqueue";
import {
  DISTRIBUTION_AGREEMENT_VERSION,
  buildDistributionAgreementDocumentHtml,
} from "@/lib/legal/distribution-agreement";

type SignResult =
  | { ok: true; data: { agreementId: string } }
  | { ok: false; error: string };

function normalizedName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export async function signDistributionAgreementAction(input: {
  signatureText: string;
  declarations: {
    ownsRights: boolean;
    hasAuthority: boolean;
    acceptsFraudPolicy: boolean;
    acceptsElectronicSignature: boolean;
  };
}): Promise<SignResult> {
  const ctx = await RequireRole(["artist", "label"], {
    allowUnsignedAgreement: true,
  });

  const service = createServiceClient();
  const [{ data: identity, error: identityError }, { data: company, error: companyError }] =
    await Promise.all([
      service
        .from("identity_verifications")
        .select("id,status,legal_name,country_code,verified_at")
        .eq("user_id", ctx.userId)
        .maybeSingle(),
      service
        .from("distribution_agreement_company_authorizations")
        .select("id,agreement_version,authorized_legal_name,authorized_title,authorized_at,metadata")
        .eq("agreement_version", DISTRIBUTION_AGREEMENT_VERSION)
        .eq("is_active", true)
        .maybeSingle(),
    ]);

  if (identityError || !identity || identity.status !== "verified" || !identity.verified_at) {
    return { ok: false, error: "Identity verification must be approved before signing." };
  }
  if (companyError || !company) {
    return { ok: false, error: "The current Nexo distribution agreement is not available." };
  }

  const signatureText = input.signatureText.trim().replace(/\s+/g, " ");
  if (!signatureText || normalizedName(signatureText) !== normalizedName(identity.legal_name)) {
    return {
      ok: false,
      error: "Your electronic signature must exactly match your verified legal name.",
    };
  }

  const declarations = input.declarations;
  if (
    !declarations.ownsRights ||
    !declarations.hasAuthority ||
    !declarations.acceptsFraudPolicy ||
    !declarations.acceptsElectronicSignature
  ) {
    return { ok: false, error: "All agreement declarations must be accepted." };
  }

  const accountType = ctx.roles.includes("label") ? "label" : "artist";
  const entitlements = await safeGetEntitlementsForAuth(ctx);
  const commissionBps = entitlements.paidAccess ? 1000 : 2000;
  const signedAt = new Date().toISOString();
  const metadata =
    company.metadata && typeof company.metadata === "object"
      ? (company.metadata as Record<string, unknown>)
      : {};
  const companyLegalName =
    typeof metadata.company === "string" && metadata.company.trim()
      ? metadata.company.trim()
      : "NEXO MUSIC DISTRIBUTION LTD";

  const documentHtml = buildDistributionAgreementDocumentHtml({
    legalName: identity.legal_name,
    accountType,
    email: ctx.email,
    countryCode: identity.country_code,
    planId: entitlements.planId,
    commissionBps,
    signedAt,
    companyLegalName,
    companyAuthorizedName: company.authorized_legal_name,
    companyAuthorizedTitle: company.authorized_title,
  });
  const documentSha256 = createHash("sha256").update(documentHtml, "utf8").digest("hex");

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for") ?? "";
  const clientIp = forwardedFor.split(",")[0]?.trim().slice(0, 120) || null;
  const userAgent = requestHeaders.get("user-agent")?.slice(0, 1000) || null;

  const { data: agreementId, error } = await service.rpc(
    "sign_distribution_agreement_service",
    {
      p_user_id: ctx.userId,
      p_agreement_version: DISTRIBUTION_AGREEMENT_VERSION,
      p_plan_id: entitlements.planId,
      p_commission_bps: commissionBps,
      p_signature_text: signatureText,
      p_declarations: {
        owns_rights: declarations.ownsRights,
        has_authority: declarations.hasAuthority,
        accepts_fraud_policy: declarations.acceptsFraudPolicy,
        accepts_electronic_signature: declarations.acceptsElectronicSignature,
      },
      p_document_html: documentHtml,
      p_document_sha256: documentSha256,
      p_client_ip: clientIp,
      p_user_agent: userAgent,
    }
  );

  if (error || !agreementId) {
    return {
      ok: false,
      error: error?.message || "Could not sign the distribution agreement.",
    };
  }

  await enqueueEmailEvent(service, {
    eventType: "account.status",
    templateKey: "AGREEMENT_SIGNED",
    recipientUserId: ctx.userId,
    recipientEmail: ctx.email,
    relatedEntityType: "distribution_agreement",
    relatedEntityId: String(agreementId),
    payload: {
      FIRST_NAME: identity.legal_name.split(/\s+/)[0] || identity.legal_name,
      AGREEMENT_VERSION: DISTRIBUTION_AGREEMENT_VERSION,
      SIGNED_AT: signedAt,
      CTA_URL: "https://nexomusicdistribution.com/dashboard",
      CTA_LABEL: "Open dashboard",
    },
    idempotencyKey: `AGREEMENT_SIGNED:${ctx.userId}:${DISTRIBUTION_AGREEMENT_VERSION}`,
    createdBy: ctx.userId,
  }).catch(() => null);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  revalidatePath("/distribution-agreement");
  revalidatePath("/admin/agreements");

  return { ok: true, data: { agreementId: String(agreementId) } };
}
