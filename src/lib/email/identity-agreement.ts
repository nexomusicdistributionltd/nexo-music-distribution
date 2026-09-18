import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueEmailEvent } from "@/lib/email/enqueue";
import { drainQueuedOutbox } from "@/lib/email/hooks";
import { getSiteUrl } from "@/lib/site-url";

type IdentityMailKind =
  | "IDENTITY_SUBMITTED"
  | "IDENTITY_VERIFIED"
  | "IDENTITY_DECLINED"
  | "IDENTITY_ADDITIONAL_INFO_REQUIRED";

export async function queueIdentityAccountEmail(input: {
  supabase: SupabaseClient;
  userId: string;
  verificationId: string;
  templateKey: IdentityMailKind;
  reason?: string | null;
  legalName?: string | null;
}) {
  const { data: profile } = await input.supabase
    .from("profiles")
    .select("email,full_name,display_name")
    .eq("id", input.userId)
    .maybeSingle();
  const email = profile?.email?.trim();
  if (!email) return;
  const name = String(input.legalName || profile?.full_name || profile?.display_name || "there").trim();
  const firstName = name.split(/\s+/)[0] || "there";
  await enqueueEmailEvent(input.supabase, {
    eventType: "identity",
    templateKey: input.templateKey,
    recipientUserId: input.userId,
    recipientEmail: email,
    relatedEntityType: "identity_verification",
    relatedEntityId: input.verificationId,
    payload: {
      FIRST_NAME: firstName,
      REASON: input.reason ?? "",
      CTA_URL: `${getSiteUrl()}${input.templateKey === "IDENTITY_VERIFIED" ? "/distribution-agreement" : "/verify-identity"}`,
    },
    idempotencyKey: `${input.templateKey}:${input.verificationId}:${input.reason ?? ""}`,
  });
  void drainQueuedOutbox(10);
}

export async function queueAgreementSignedEmail(input: {
  supabase: SupabaseClient;
  userId: string;
  agreementId: string;
  legalName: string;
}) {
  const { data: profile } = await input.supabase
    .from("profiles")
    .select("email")
    .eq("id", input.userId)
    .maybeSingle();
  const email = profile?.email?.trim();
  if (!email) return;
  await enqueueEmailEvent(input.supabase, {
    eventType: "agreement",
    templateKey: "AGREEMENT_SIGNED",
    recipientUserId: input.userId,
    recipientEmail: email,
    relatedEntityType: "distribution_agreement",
    relatedEntityId: input.agreementId,
    payload: {
      FIRST_NAME: input.legalName.split(/\s+/)[0] || input.legalName,
      AGREEMENT_ID: input.agreementId,
      CTA_URL: `${getSiteUrl()}/api/agreements/${input.agreementId}/download`,
    },
    idempotencyKey: `AGREEMENT_SIGNED:${input.agreementId}`,
  });
  void drainQueuedOutbox(10);
}
