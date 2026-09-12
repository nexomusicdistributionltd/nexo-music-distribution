import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/marketing/PageHero";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Section, Eyebrow } from "@/components/marketing/Section";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Pricing for NEXO Music Distribution is being finalized. Contact Nexo for current plans and label options.",
  alternates: { canonical: `${SITE_URL}/pricing` },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Plans that match your catalog"
        description="Commercial pricing is being finalized. Until published rates are available, contact Nexo for artist and label options — we will not invent numbers here."
        crumbs={[{ label: "Home", href: "/" }, { label: "Pricing" }]}
      />

      <Section>
        <Alert title="Pricing is being finalized">
          Contact Nexo for current distribution and publishing options. No invented prices,
          percentages, or promotional claims appear on this page.
        </Alert>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {[
            {
              name: "Artists",
              body: "Independent release distribution with royalty workflows and optional publishing pathways.",
              cta: { href: "/get-started", label: "Get Started" },
            },
            {
              name: "Labels",
              body: "Multi-artist delivery, QC standards, and reporting structured for roster operations.",
              cta: { href: "/contact", label: "Contact Sales" },
            },
            {
              name: "Publishing",
              body: "Nexo Publishing Group capabilities — sync, mechanical, administration, and statements.",
              cta: { href: "/publishing", label: "Explore Publishing" },
            },
          ].map((tier) => (
            <article
              key={tier.name}
              className="flex flex-col rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6"
            >
              <Eyebrow>{tier.name}</Eyebrow>
              <h2 className="mt-3 text-h3">Custom quote</h2>
              <p className="mt-2 flex-1 text-small text-[var(--nexo-text-muted)]">{tier.body}</p>
              <p className="mt-6 text-caption uppercase tracking-[0.12em] text-[var(--nexo-text-muted)]">
                Price — contact Nexo
              </p>
              <Link href={tier.cta.href} className="mt-4 inline-flex">
                <Button variant="outline" className="gap-2 rounded-full">
                  {tier.cta.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </article>
          ))}
        </div>
      </Section>

      <FinalCta
        title="Request pricing from Nexo"
        description="Share your release volume and whether you need publishing. We will respond with accurate commercial options."
      />
    </>
  );
}
