import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Layers, Users, FileSpreadsheet } from "lucide-react";
import { PageHero } from "@/components/marketing/PageHero";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Section, Eyebrow } from "@/components/marketing/Section";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { Button } from "@/components/ui/Button";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "For Labels",
  description:
    "Multi-artist distribution, quality control, and royalty workflows for independent labels with NEXO Music Distribution.",
  alternates: { canonical: `${SITE_URL}/labels` },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="For Labels"
        title="Operate a roster with clarity"
        description="Independent labels need repeatable delivery, consistent QC, and royalty reporting that scales across artists. NEXO is structured for that operational reality."
        crumbs={[{ label: "Home", href: "/" }, { label: "For Labels" }]}
      >
        <Link href="/contact">
          <Button className="gap-2 rounded-full">
            Contact Sales <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </PageHero>

      <Section>
        <Eyebrow>Label operations</Eyebrow>
        <h2 className="mt-3 text-h2">Built for multi-artist catalogs</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<Users className="h-5 w-5" />}
            title="Roster-minded"
            description="Coordinate releases across artists without reinventing process for every project."
          />
          <FeatureCard
            icon={<Layers className="h-5 w-5" />}
            title="Consistent QC"
            description="Shared standards for audio, artwork, and metadata before platform delivery."
          />
          <FeatureCard
            icon={<FileSpreadsheet className="h-5 w-5" />}
            title="Royalty reporting"
            description="Statements and payout workflows that keep label accounting understandable."
          />
          <FeatureCard
            icon={<Building2 className="h-5 w-5" />}
            title="Publishing adjacent"
            description="Connect distribution with Nexo Publishing Group when works administration matters."
          />
        </div>
      </Section>

      <Section surface>
        <div className="max-w-2xl">
          <h2 className="text-h2">No fabricated roster stories</h2>
          <p className="mt-3 text-body text-[var(--nexo-text-muted)]">
            This site does not invent label partners, roster sizes beyond confirmed company
            figures, or sample deal structures. Talk with Nexo for commercial details.
          </p>
        </div>
      </Section>

      <FinalCta title="Talk label distribution with Nexo" />
    </>
  );
}
