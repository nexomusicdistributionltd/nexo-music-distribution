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
    "Start with NEXO Music Distribution — create an artist or label account to access the portal.",
  alternates: { canonical: `${SITE_URL}/get-started` },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Get Started"
        title="Begin with Nexo"
        description="Create an artist or label account to access the portal. Distribution APIs and payments are not connected yet — registration and authentication are real."
        crumbs={[{ label: "Home", href: "/" }, { label: "Get Started" }]}
      />

      <Section>
        <Alert title="Account creation">
          Self-serve artist and label registration is available. Staff accounts are provisioned by Nexo.
          Use Contact for commercial questions.
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
              <Link href="/register?type=artist">
                <Button className="gap-2 rounded-full">
                  Register <ArrowRight className="h-4 w-4" />
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
              <Link href="/register?type=label">
                <Button className="gap-2 rounded-full">
                  Register label <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </article>
        </div>
      </Section>
    </>
  );
}
