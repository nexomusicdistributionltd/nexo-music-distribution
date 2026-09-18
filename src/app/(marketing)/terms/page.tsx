import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";
import { CmsManagedLegalPage } from "@/components/cms/CmsManagedLegalPage";
import { cmsLegalMetadata } from "@/lib/cms/legal-metadata";
import { LEGAL_UPDATED, TERMS_SECTIONS } from "@/lib/legal/copy";

const fallbackMetadata = legalMetadata({
  title: "Terms of Service",
  description:
    "Terms of Service for NEXO MUSIC DISTRIBUTION LTD covering accounts, distribution, publishing, and Paddle-billed subscriptions at nexomusicdistribution.com.",
  path: "/terms",
});

export async function generateMetadata() {
  return cmsLegalMetadata({
    slug: "terms",
    path: "/terms",
    fallback: fallbackMetadata,
  });
}

export default function Page() {
  return (
    <CmsManagedLegalPage
      slug="terms"
      fallback={
        <LegalDocument
          title="Terms of Service"
          crumb="Terms of Service"
          updated={LEGAL_UPDATED}
          sections={TERMS_SECTIONS}
        />
      }
    />
  );
}
