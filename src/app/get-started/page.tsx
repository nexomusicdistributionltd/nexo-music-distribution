import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/marketing/PageHero";
import { Section, Eyebrow } from "@/components/marketing/Section";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Get Started",
  description:
    "Start with NEXO Music Distribution — register interest for artist or label onboarding. Account creation connects in a later batch.",
  alternates: { canonical: `${SITE_URL}/get-started` },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Get Started"
        title="Begin with Nexo"
        description="Tell us whether you are an artist or a label. Full account creation and payments are not connected in this public website build — interest and contact paths are real."
        crumbs={[{ label: "Home", href: "/" }, { label: "Get Started" }]}
      />

      <Section>
        <Alert title="Onboarding status">
          Self-serve signup is coming later. Use Contact for commercial questions, or choose a
          path below to continue browsing while we prepare account creation.
        </Alert>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <article className="rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6">
            <Eyebrow>Artists</Eyebrow>
            <h2 className="mt-3 text-h3">Independent releases</h2>
            <p className="mt-2 text-small text-[var(--nexo-text-muted)]">
              Distribution to 450+ platforms, royalty workflows, and optional publishing through
              Nexo Publishing Group.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/artists">
                <Button variant="outline" className="rounded-full">
                  For Artists
                </Button>
              </Link>
              <Link href="/contact">
                <Button className="gap-2 rounded-full">
                  Contact <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </article>
          <article className="rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6">
            <Eyebrow>Labels</Eyebrow>
            <h2 className="mt-3 text-h3">Roster operations</h2>
            <p className="mt-2 text-small text-[var(--nexo-text-muted)]">
              Multi-artist delivery, QC standards, and reporting. Pricing is available via
              Contact Sales until public rates are published.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/labels">
                <Button variant="outline" className="rounded-full">
                  For Labels
                </Button>
              </Link>
              <Link href="/contact">
                <Button className="gap-2 rounded-full">
                  Contact Sales <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </article>
        </div>
      </Section>
    </>
  );
}
