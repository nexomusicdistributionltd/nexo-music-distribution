import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";
import { CmsManagedLegalPage } from "@/components/cms/CmsManagedLegalPage";
import { cmsLegalMetadata } from "@/lib/cms/legal-metadata";
import { SUPPORT_EMAIL } from "@/lib/brand/contact";
import { LEGAL_UPDATED, PRIVACY_SECTIONS } from "@/lib/legal/copy";

const fallbackMetadata = legalMetadata({
  title: "Privacy Policy",
  description:
    "Privacy Policy for NEXO MUSIC DISTRIBUTION LTD explaining how we process account, catalog, and billing data. Contact ${SUPPORT_EMAIL}.",
  path: "/privacy",
});

export async function generateMetadata() {
  return cmsLegalMetadata({
    slug: "privacy",
    path: "/privacy",
    fallback: fallbackMetadata,
  });
}

export default function Page() {
  return (
    <CmsManagedLegalPage
      slug="privacy"
      fallback={
        <LegalDocument
          title="Privacy Policy"
          crumb="Privacy Policy"
          updated={LEGAL_UPDATED}
          sections={PRIVACY_SECTIONS}
        />
      }
    />
  );
}
