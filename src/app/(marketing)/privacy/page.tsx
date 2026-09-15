import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";
import { LEGAL_UPDATED, PRIVACY_SECTIONS } from "@/lib/legal/copy";

export const metadata = legalMetadata({
  title: "Privacy Policy",
  description:
    "Privacy Policy for NEXO MUSIC DISTRIBUTION LTD explaining how we process account, catalog, and billing data. Contact contact@nexomusicdistro.space.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      crumb="Privacy Policy"
      updated={LEGAL_UPDATED}
      sections={PRIVACY_SECTIONS}
    />
  );
}
