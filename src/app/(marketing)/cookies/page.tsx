import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";
import { LEGAL_BUSINESS_NAME, LEGAL_UPDATED, COOKIES_SECTIONS } from "@/lib/legal/copy";

export const metadata = legalMetadata({
  title: "Cookie Policy",
  description: `Cookie Policy for ${LEGAL_BUSINESS_NAME} describing essential authentication cookies, Paddle checkout cookies, and how to manage them.`,
  path: "/cookies",
});

export default function CookiesPage() {
  return (
    <LegalDocument
      title="Cookie Policy"
      crumb="Cookie Policy"
      description={`${LEGAL_BUSINESS_NAME} cookie and similar-technology notice for the public site and dashboards.`}
      updated={LEGAL_UPDATED}
      sections={COOKIES_SECTIONS}
    />
  );
}
