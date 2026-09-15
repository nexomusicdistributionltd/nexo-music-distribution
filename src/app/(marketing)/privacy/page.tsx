import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";
import { LEGAL_BUSINESS_NAME, LEGAL_CONTACT_EMAIL, LEGAL_UPDATED, PRIVACY_SECTIONS } from "@/lib/legal/copy";

export const metadata = legalMetadata({
  title: "Privacy Policy",
  description: `Privacy Policy for ${LEGAL_BUSINESS_NAME} explaining how we process account, catalog, and billing data. Contact ${LEGAL_CONTACT_EMAIL}.`,
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      crumb="Privacy Policy"
      description={`How ${LEGAL_BUSINESS_NAME} processes account, catalog, and billing data. Paddle.com is Merchant of Record for paid checkout.`}
      updated={LEGAL_UPDATED}
      sections={PRIVACY_SECTIONS}
    />
  );
}
