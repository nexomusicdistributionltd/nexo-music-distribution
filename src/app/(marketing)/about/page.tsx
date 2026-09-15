import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/marketing/PageHero";
import { HeroImage } from "@/components/website/HeroImage";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Section, Eyebrow } from "@/components/marketing/Section";
import { Button } from "@/components/ui/Button";
import { CONFIRMED_STATS, COMPANY_LEGAL, PUBLISHING_DIVISION, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "About NEXO MUSIC DISTRIBUTION LTD — digital music distribution, publishing, and royalty management. Publishing division: Nexo Publishing Group.",
  alternates: { canonical: `${SITE_URL}/about` },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title={COMPANY_LEGAL}
        description="Digital music distribution, publishing, and royalty management for independent artists and labels. Publishing division: Nexo Publishing Group."
        crumbs={[{ label: "Home", href: "/" }, { label: "About" }]}
        aside={<HeroImage preset="console" alt="" />}
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <Eyebrow>Mission</Eyebrow>
            <h2 className="mt-3 text-h2">Infrastructure for independent music</h2>
            <p className="mt-4 text-body text-[var(--nexo-text-muted)]">
              NEXO exists to help artists and labels move music into the world with
              professional distribution, clearer royalty workflows, and publishing support
              through {PUBLISHING_DIVISION}. We build toward a finished music-tech company
              experience — without inventing founders, offices, awards, or partnerships we
              cannot verify.
            </p>
            <p className="mt-4 text-body text-[var(--nexo-text-muted)]">
              Website:{" "}
              <a
                href={SITE_URL}
                className="underline underline-offset-4 hover:text-[var(--nexo-text)]"
                rel="noopener noreferrer"
              >
                nexomusicdistribution.com
              </a>
            </p>
          </div>
          <div className="rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-8">
            <Eyebrow>Confirmed figures</Eyebrow>
            <dl className="mt-6 grid grid-cols-2 gap-6">
              {CONFIRMED_STATS.map((s) => (
                <div key={s.label}>
                  <dt className="text-caption text-[var(--nexo-text-muted)]">{s.label}</dt>
                  <dd className="mt-1 text-h2">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Section>

      <Section surface>
        <div className="max-w-2xl">
          <h2 className="text-h2">What this page does not claim</h2>
          <p className="mt-3 text-body text-[var(--nexo-text-muted)]">
            No invented team biographies, headquarters stories, press awards, or celebrity
            clients. When those details are ready to publish accurately, they will appear here.
          </p>
          <Link href="/contact" className="mt-6 inline-flex">
            <Button className="rounded-full">Contact</Button>
          </Link>
        </div>
      </Section>

      <FinalCta />
    </>
  );
}
