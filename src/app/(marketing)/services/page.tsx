import type { Metadata } from "next";
import { PageHero } from "@/components/marketing/PageHero";
import { FinalCta } from "@/components/marketing/FinalCta";
import { ServiceRows } from "@/components/public/ServiceRows";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Services",
  description:
    "NEXO services: digital distribution, Nexo Publishing Group, royalty management, analytics, Content ID protection, and support.",
  alternates: { canonical: `${SITE_URL}/services` },
};

const SERVICES = [
  {
    index: "01",
    title: "Digital distribution",
    body: "Release delivery to 450+ platforms with quality control and catalog workflows.",
    href: "/distribution",
  },
  {
    index: "02",
    title: "Nexo Publishing Group",
    body: "Sync, mechanical, performance administration, creative services, and statements.",
    href: "/publishing",
  },
  {
    index: "03",
    title: "Royalty management",
    body: "Statement visibility and payout pathways for growing catalogs.",
    href: "/pricing",
  },
  {
    index: "04",
    title: "Analytics",
    body: "Performance views that help you understand how releases are landing.",
    href: "/distribution",
  },
  {
    index: "05",
    title: "Content ID protection",
    body: "Tools to help claim and monetize usage of your recordings across platforms.",
    href: "/contact",
  },
  {
    index: "06",
    title: "Support",
    body: "Guidance for artists and labels across release and catalog operations.",
    href: "/contact",
  },
];

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Services"
        title="Everything you need and more."
        description="A complete public overview of what NEXO MUSIC DISTRIBUTION LTD offers artists and labels — described accurately, without invented partnerships."
        crumbs={[{ label: "Home", href: "/" }, { label: "Services" }]}
      />
      <section className="pub-container pb-[var(--pub-section)]">
        <ServiceRows items={SERVICES} />
      </section>
      <FinalCta />
    </>
  );
}
