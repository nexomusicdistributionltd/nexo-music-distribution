import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Globe2, ListChecks, ShieldCheck, BarChart3 } from "lucide-react";
import { PageHero } from "@/components/marketing/PageHero";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Section, Eyebrow } from "@/components/marketing/Section";
import { FeatureCard } from "@/components/ui/FeatureCard";
import { Button } from "@/components/ui/Button";
import { DspMarquee } from "@/components/marketing/DspMarquee";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Distribution",
  description:
    "Digital music distribution to 450+ platforms with quality control, analytics, and royalty workflows from NEXO Music Distribution.",
  alternates: { canonical: `${SITE_URL}/distribution` },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Distribution"
        title="Get your music everywhere."
        description="NEXO delivers releases for independent artists and labels — with quality control, catalog visibility, and royalty pathways designed for professional catalogs."
        crumbs={[{ label: "Home", href: "/" }, { label: "Distribution" }]}
      >
        <div className="flex flex-wrap gap-3">
          <Link href="/get-started">
            <Button className="gap-2 rounded-full">
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/pricing">
            <Button variant="outline" className="rounded-full">
              Pricing
            </Button>
          </Link>
        </div>
      </PageHero>

      <DspMarquee />

      <Section>
        <Eyebrow>Capabilities</Eyebrow>
        <h2 className="mt-3 text-h2">Distribution that respects the work</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<Globe2 className="h-5 w-5" />}
            title="Global delivery"
            description="Reach major streaming services, social platforms, and specialist storefronts worldwide."
          />
          <FeatureCard
            icon={<ListChecks className="h-5 w-5" />}
            title="Quality control"
            description="Audio, artwork, and metadata review before delivery — without claiming guaranteed store approval."
          />
          <FeatureCard
            icon={<BarChart3 className="h-5 w-5" />}
            title="Catalog visibility"
            description="Follow release status and performance trends as reporting data becomes available."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Rights-aware process"
            description="Structured release workflows that keep ownership and compliance considerations in view."
          />
        </div>
      </Section>

      <Section surface>
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-3 text-h2">A clear delivery path</h2>
            <ol className="mt-6 space-y-4 text-small text-[var(--nexo-text-secondary)]">
              {[
                "Prepare audio, artwork, and metadata",
                "Submit for Nexo quality control",
                "Select platforms and release timing",
                "Deliver to storefronts and track status",
                "Review royalties as statements arrive",
              ].map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="font-mono text-caption text-[var(--nexo-text-muted)]">
                    0{i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-8">
            <h3 className="text-h3">Artists &amp; labels</h3>
            <p className="mt-3 text-small text-[var(--nexo-text-muted)]">
              Whether you release as an independent artist or operate a roster, distribution
              sits on the same professional foundation — with publishing available through
              Nexo Publishing Group when you need it.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/artists">
                <Button variant="outline" size="sm" className="rounded-full">
                  For Artists
                </Button>
              </Link>
              <Link href="/labels">
                <Button variant="outline" size="sm" className="rounded-full">
                  For Labels
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Section>

      <FinalCta
        title="Start distribution with Nexo"
        description="Tell us about your catalog and release plans. We will guide next steps honestly — no invented timelines or fake onboarding."
      />
    </>
  );
}
