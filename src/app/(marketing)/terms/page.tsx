import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";
import { LEGAL_BUSINESS_NAME, LEGAL_CONTACT_EMAIL, LEGAL_UPDATED, TERMS_SECTIONS } from "@/lib/legal/copy";

export const metadata = legalMetadata({
  title: "Terms of Service",
  description: `Terms of Service for ${LEGAL_BUSINESS_NAME} covering accounts, distribution, publishing, and Paddle-billed subscriptions at nexomusicdistribution.com.`,
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      crumb="Terms of Service"
      description={`${LEGAL_BUSINESS_NAME} — terms for the public website, artist and label accounts, and Paddle-billed subscriptions.`}
      updated={LEGAL_UPDATED}
      sections={TERMS_SECTIONS}
    />
  );
}
