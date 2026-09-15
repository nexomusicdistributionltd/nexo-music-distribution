import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";
import { LEGAL_UPDATED, COOKIES_SECTIONS } from "@/lib/legal/copy";

export const metadata = legalMetadata({
  title: "Cookie Policy",
  description:
    "Cookie Policy for NEXO MUSIC DISTRIBUTION LTD describing essential authentication cookies, Paddle checkout cookies, and how to manage them.",
  path: "/cookies",
});

export default function CookiesPage() {
  return (
    <LegalDocument
      title="Cookie Policy"
      crumb="Cookie Policy"
      updated={LEGAL_UPDATED}
      sections={COOKIES_SECTIONS}
    />
  );
}
