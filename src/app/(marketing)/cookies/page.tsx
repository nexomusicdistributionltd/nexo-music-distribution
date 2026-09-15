import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";
import { LEGAL_BUSINESS_NAME, LEGAL_CONTACT_EMAIL, LEGAL_UPDATED, COOKIES_SECTIONS } from "@/lib/legal/copy";

export const metadata = legalMetadata({
  title: "Cookies Policy",
  description: `Cookies Policy for ${LEGAL_BUSINESS_NAME}: essential authentication cookies, theme preference in local storage, Paddle checkout, and how to control cookies. Contact ${LEGAL_CONTACT_EMAIL}. We do not currently run advertising pixels.`,
  path: "/cookies",
});

export default function CookiesPage() {
  return (
    <LegalDocument
      title="Cookies Policy"
      crumb="Cookies Policy"
      description={`${LEGAL_BUSINESS_NAME} Cookies Policy for nexomusicdistribution.com — what we actually use, how to control cookies in your browser, and how this page relates to the Privacy Policy.`}
      updated={LEGAL_UPDATED}
      sections={COOKIES_SECTIONS}
    />
  );
}
