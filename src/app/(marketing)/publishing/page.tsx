import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, PenLine } from "lucide-react";
import { PageHero } from "@/components/marketing/PageHero";
import { FinalCta } from "@/components/marketing/FinalCta";
import { Section, Eyebrow } from "@/components/marketing/Section";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SITE_URL, PUBLISHING_DIVISION } from "@/lib/site";

export const metadata: Metadata = {
  title: "Publishing | Nexo Publishing Group",
  description:
    "Nexo Publishing Group — sync licensing, mechanical royalties, performance administration, creative services, and publishing statements.",
  alternates: { canonical: `${SITE_URL}/publishing` },
};

const PILLARS = [
  {
    id: "sync",
    title: "Sync licensing",
    body: "Identify and pursue synchronization opportunities for compositions across film, television, advertising, games, and digital media.",
  },
  {
    id: "mechanical",
    title: "Mechanical royalties",
    body: "Administer mechanical rights related to reproductions of musical works across digital and physical formats.",
  },
  {
    id: "performance",
    title: "Performance royalties",
    body: "Support pathways for performance royalty collection tied to public performance and broadcast uses of your works.",
  },
  {
    id: "admin",
    title: "Publishing administration",
    body: "Keep works data, splits, and rights registrations organized so catalogs remain accurate and actionable.",
  },
  {
    id: "creative",
    title: "Creative services",
    body: "Creative support for writers and catalogs seeking development and placement opportunities.",
  },
  {
    id: "statements",
    title: "Statements",
    body: "Provide clear publishing statements so you can review how works are performing over time.",
  },
];

function PublishingHeroAside() {
  return (
    <div className="relative hidden lg:block" aria-hidden>
      <div className="absolute -inset-4 rounded-[1.75rem] border border-[var(--nexo-border)] opacity-50" />
      <div className="relative overflow-hidden rounded-[1.35rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 shadow-[var(--nexo-shadow-lg)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05] dark:opacity-[0.09]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, transparent, transparent 14px, var(--nexo-text) 14px, var(--nexo-text) 15px)",
          }}
        />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-elevated)]">
              <PenLine className="h-4 w-4 text-[var(--nexo-text)]" />
            </div>
            <Badge>New</Badge>
          </div>
          <p className="mt-5 text-caption uppercase tracking-[0.14em] text-[var(--nexo-text-muted)]">
            {PUBLISHING_DIVISION}
          </p>
          <p
            className="mt-3 text-2xl italic leading-snug text-[var(--nexo-text-secondary)]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Rights. Sync.
            <br />
            Clear statements.
          </p>
          <ul className="mt-8 space-y-2.5 border-t border-[var(--nexo-divider)] pt-5">
            {["Sync licensing", "Mechanical & performance", "Admin & statements"].map(
              (label) => (
                <li
                  key={label}
                  className="flex items-center gap-2.5 text-small text-[var(--nexo-text-secondary)]"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--nexo-text)]"
                    aria-hidden
                  />
                  {label}
                </li>
              )
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow={PUBLISHING_DIVISION}
        title="Your music. Our publishing."
        description="Nexo Publishing Group sits alongside distribution — helping artists and labels organize rights, pursue sync, administer royalties, and keep publishing statements clear. We do not invent PRO affiliations or DSP partnership claims."
        crumbs={[{ label: "Home", href: "/" }, { label: "Publishing" }]}
        aside={<PublishingHeroAside />}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Badge>New</Badge>
          <Link href="/get-started">
            <Button className="gap-2 rounded-full">
              Talk Publishing <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </PageHero>

      <Section>
        <div className="flex items-start gap-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-elevated)]">
            <PenLine className="h-5 w-5" />
          </div>
          <div className="max-w-2xl">
            <Eyebrow>Division</Eyebrow>
            <h2 className="mt-2 text-h2">{PUBLISHING_DIVISION}</h2>
            <p className="mt-3 text-body text-[var(--nexo-text-muted)]">
              Publishing and distribution work better together. Bring masters and compositions
              into one company relationship without overstating what any partner can promise.
            </p>
          </div>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => (
            <article
              key={p.id}
              id={p.id}
              className="scroll-mt-24 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6"
            >
              <h3 className="text-h4">{p.title}</h3>
              <p className="mt-2 text-small text-[var(--nexo-text-muted)]">{p.body}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section surface>
        <div className="max-w-2xl">
          <Eyebrow>Accuracy</Eyebrow>
          <h2 className="mt-3 text-h2">Honest publishing language</h2>
          <p className="mt-3 text-body text-[var(--nexo-text-muted)]">
            Collection societies, DSPs, and licensees each have their own rules and timelines.
            Nexo helps you administer and pursue opportunities — we do not claim guaranteed
            placements, exclusive PRO relationships, or unverified partner networks.
          </p>
        </div>
      </Section>

      <FinalCta title="Ask about Nexo Publishing Group" />
    </>
  );
}
