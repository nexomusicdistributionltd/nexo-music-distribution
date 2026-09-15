import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";
import { LEGAL_UPDATED, TERMS_SECTIONS } from "@/lib/legal/copy";

export const metadata = legalMetadata({
  title: "Terms of Service",
  description:
    "Terms of Service for NEXO MUSIC DISTRIBUTION LTD covering accounts, distribution, publishing, and Paddle-billed subscriptions at nexomusicdistribution.com.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      crumb="Terms of Service"
      updated={LEGAL_UPDATED}
      sections={TERMS_SECTIONS}
    />
  );
}
