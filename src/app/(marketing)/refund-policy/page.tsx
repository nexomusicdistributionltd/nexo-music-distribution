import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";
import { LEGAL_UPDATED, REFUND_POLICY_SECTIONS } from "@/lib/legal/copy";

export const metadata = legalMetadata({
  title: "Refund Policy",
  description:
    "Refund Policy for NEXO MUSIC DISTRIBUTION LTD digital music-distribution subscriptions billed by Paddle. Contact contact@nexomusicdistro.space.",
  path: "/refund-policy",
});

export default function RefundPolicyPage() {
  return (
    <LegalDocument
      title="Refund Policy"
      crumb="Refund Policy"
      description="Refund Policy for NEXO MUSIC DISTRIBUTION LTD subscriptions billed by Paddle. Cancellation is not an automatic refund for time already used."
      updated={LEGAL_UPDATED}
      sections={REFUND_POLICY_SECTIONS}
    />
  );
}
