import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";
import { CmsManagedLegalPage } from "@/components/cms/CmsManagedLegalPage";
import { cmsLegalMetadata } from "@/lib/cms/legal-metadata";
import { SUPPORT_EMAIL } from "@/lib/brand/contact";
import { LEGAL_UPDATED, REFUND_POLICY_SECTIONS } from "@/lib/legal/copy";

const fallbackMetadata = legalMetadata({
  title: "Refund Policy",
  description:
    "Refund Policy for NEXO MUSIC DISTRIBUTION LTD digital music-distribution subscriptions billed by Paddle. Contact ${SUPPORT_EMAIL}.",
  path: "/refund-policy",
});

export async function generateMetadata() {
  return cmsLegalMetadata({
    slug: "refund-policy",
    path: "/refund-policy",
    fallback: fallbackMetadata,
  });
}

export default function Page() {
  return (
    <CmsManagedLegalPage
      slug="refund-policy"
      fallback={
        <LegalDocument
          title="Refund Policy"
          crumb="Refund Policy"
          updated={LEGAL_UPDATED}
          sections={REFUND_POLICY_SECTIONS}
        />
      }
    />
  );
}
