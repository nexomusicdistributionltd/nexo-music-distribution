import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";
import { CmsManagedLegalPage } from "@/components/cms/CmsManagedLegalPage";
import { cmsLegalMetadata } from "@/lib/cms/legal-metadata";
import { LEGAL_UPDATED, COOKIES_SECTIONS } from "@/lib/legal/copy";

const fallbackMetadata = legalMetadata({
  title: "Cookie Policy",
  description:
    "Cookie Policy for NEXO MUSIC DISTRIBUTION LTD describing essential authentication cookies, Paddle checkout cookies, and how to manage them.",
  path: "/cookies",
});

export async function generateMetadata() {
  return cmsLegalMetadata({
    slug: "cookies",
    path: "/cookies",
    fallback: fallbackMetadata,
  });
}

export default function Page() {
  return (
    <CmsManagedLegalPage
      slug="cookies"
      fallback={
        <LegalDocument
          title="Cookie Policy"
          crumb="Cookie Policy"
          updated={LEGAL_UPDATED}
          sections={COOKIES_SECTIONS}
        />
      }
    />
  );
}
