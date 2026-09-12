import type { Metadata } from "next";
import Link from "next/link";
import {
  Globe2,
  PenLine,
  Scale,
  ShieldCheck,
  BarChart3,
  Headphones,
} from "lucide-react";
import { PageHero } from "@/components/marketing/PageHero";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Section, Eyebrow } from "@/components/marketing/Section";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { Button } from "@/components/ui/Button";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Services",
  description:
    "NEXO services: digital distribution, Nexo Publishing Group, royalty management, analytics, Content ID protection, and support.",
  alternates: { canonical: `${SITE_URL}/services` },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Services"
        title="Distribution, publishing, and royalties"
        description="A complete public overview of what NEXO MUSIC DISTRIBUTION LTD offers artists and labels — described accurately, without invented partnerships."
        crumbs={[{ label: "Home", href: "/" }, { label: "Services" }]}
      />

      <Section>
        <Eyebrow>Core services</Eyebrow>
        <h2 className="mt-3 text-h2">What we deliver</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Globe2 className="h-5 w-5" />}
            title="Digital distribution"
            description="Release delivery to 450+ platforms with quality control and catalog workflows."
          />
          <FeatureCard
            icon={<PenLine className="h-5 w-5" />}
            title="Nexo Publishing Group"
            description="Sync, mechanical, performance administration, creative services, and statements."
          />
          <FeatureCard
            icon={<Scale className="h-5 w-5" />}
            title="Royalty management"
            description="Statement visibility and payout pathways for growing catalogs."
          />
          <FeatureCard
            icon={<BarChart3 className="h-5 w-5" />}
            title="Analytics"
            description="Performance views that help you understand how releases are landing."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Content ID protection"
            description="Tools to help claim and monetize usage of your recordings across platforms."
          />
          <FeatureCard
            icon={<Headphones className="h-5 w-5" />}
            title="Support"
            description="Guidance for artists and labels across release and catalog operations."
          />
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/distribution">
            <Button variant="outline" className="rounded-full">
              Distribution
            </Button>
          </Link>
          <Link href="/publishing">
            <Button variant="outline" className="rounded-full">
              Publishing
            </Button>
          </Link>
          <Link href="/pricing">
            <Button variant="outline" className="rounded-full">
              Pricing
            </Button>
          </Link>
        </div>
      </Section>

      <FinalCta />
    </>
  );
}
