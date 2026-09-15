import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/PageHero";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Section } from "@/components/marketing/Section";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Frequently asked questions about NEXO Music Distribution, publishing, royalties, pricing, and quality control.",
  alternates: { canonical: `${SITE_URL}/faq` },
};

const FAQS = [
  {
    question: "What does NEXO Music Distribution do?",
    answer:
      "NEXO MUSIC DISTRIBUTION LTD provides digital music distribution, royalty management, and publishing support through Nexo Publishing Group for independent artists and labels.",
  },
  {
    question: "How many platforms can my music reach?",
    answer:
      "Nexo distributes to 450+ digital platforms and storefronts, including major streaming services and specialist stores. The exact destination set can evolve as the market changes.",
  },
  {
    question: "What is Nexo Publishing Group?",
    answer:
      "Nexo Publishing Group is the publishing division of NEXO. It covers sync licensing pathways, mechanical royalties, performance administration support, creative services, publishing administration, and statements — described without invented PRO or DSP relationship claims.",
  },
  {
    question: "Do you guarantee storefront or playlist approval?",
    answer:
      "No. Quality control improves release readiness for audio, artwork, metadata, and rights checks, but each platform applies its own policies. Playlist pitching outcomes are never guaranteed on this site.",
  },
  {
    question: "How does pricing work?",
    answer:
      "Artist Starter is free. Artist Pro is $9.99/month or $99/year, Label Starter is $19.99/month or $199/year, and Label Pro is $49.99/month or $499/year (USD). Approved Paddle country prices apply in the United Kingdom, Ireland, and Australia. Paid plans include a 7-day trial. Tax is calculated by Paddle at checkout.",
  },
  {
    question: "Can labels use Nexo?",
    answer:
      "Yes. Label workflows are designed for multi-artist catalogs, shared QC standards, and royalty reporting. Contact Sales or Get Started to discuss roster needs.",
  },
  {
    question: "Is the dashboard on the homepage real data?",
    answer:
      "No. Product showcase and royalty UI figures are clearly labeled demo/showcase values for illustration only — not live company results, artist earnings, or verified streams.",
  },
  {
    question: "How do I get started?",
    answer:
      "Use Get Started to register interest, or Contact for commercial questions. Artist portal login and upload tools are not part of this public website batch.",
  },
];

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="FAQ"
        title="Answers without the spin"
        description="Straightforward responses about distribution, publishing, royalties, and how this public site presents information."
        crumbs={[{ label: "Home", href: "/" }, { label: "FAQ" }]}
      />
      <Section>
        <FaqAccordion items={FAQS} />
      </Section>
      <FinalCta />
    </>
  );
}
