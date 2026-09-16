import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Headphones, Music2, Scale, PenLine } from "lucide-react";
import { PageHero } from "@/components/marketing/PageHero";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Section, Eyebrow } from "@/components/marketing/Section";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { Button } from "@/components/ui/Button";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "For Artists",
  description:
    "Digital distribution, royalty management, and publishing pathways for independent artists with NEXO Music Distribution.",
  alternates: { canonical: `${SITE_URL}/artists` },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="For Artists"
        title="Your music. Your rights."
        description="NEXO helps independent artists distribute releases, understand royalties, and access publishing support through Nexo Publishing Group — without inventing streams, testimonials, or celebrity associations."
        crumbs={[{ label: "Home", href: "/" }, { label: "For Artists" }]}
      >
        <Link href="/get-started">
          <Button className="gap-2 rounded-full">
            Get Started <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </PageHero>

      <Section>
        <Eyebrow>Why artists choose infrastructure</Eyebrow>
        <h2 className="mt-3 text-h2">Professional tools. Independent ownership.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<Music2 className="h-5 w-5" />}
            title="Release globally"
            description="Deliver singles, EPs, and albums to 450+ platforms with a clear submission path."
          />
          <FeatureCard
            icon={<Scale className="h-5 w-5" />}
            title="Track royalties"
            description="Review statements and payout workflows designed for growing independent catalogs."
          />
          <FeatureCard
            icon={<PenLine className="h-5 w-5" />}
            title="Publishing option"
            description="Explore sync, mechanical, and administration support when your writing career needs it."
          />
          <FeatureCard
            icon={<Headphones className="h-5 w-5" />}
            title="Human support"
            description="Work with a team that understands artist timelines — not a faceless black box."
          />
        </div>
      </Section>

      <Section surface>
        <div className="max-w-2xl">
          <h2 className="text-h2">What we will not invent</h2>
          <p className="mt-3 text-body text-[var(--nexo-text-muted)]">
            No fake artist spotlights, fabricated playlist placements, or unverifiable earnings
            claims. Your results belong to your music and your audience.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
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
          </div>
        </div>
      </Section>

      <FinalCta title="Start as an artist with Nexo" />
    </>
  );
}
