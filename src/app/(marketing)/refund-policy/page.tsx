import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";
import { LEGAL_BUSINESS_NAME, LEGAL_CONTACT_EMAIL, LEGAL_UPDATED, REFUND_POLICY_SECTIONS } from "@/lib/legal/copy";

export const metadata = legalMetadata({
  title: "Refund Policy",
  description: `Refund Policy for ${LEGAL_BUSINESS_NAME} digital music-distribution subscriptions billed by Paddle. Contact ${LEGAL_CONTACT_EMAIL}.`,
  path: "/refund-policy",
});

export default function RefundPolicyPage() {
  return (
    <LegalDocument
      title="Refund Policy"
      crumb="Refund Policy"
      description={`Refund Policy for ${LEGAL_BUSINESS_NAME} subscriptions billed by Paddle. Cancellation is not an automatic refund for time already used.`}
      updated={LEGAL_UPDATED}
      sections={REFUND_POLICY_SECTIONS}
    />
  );
}
