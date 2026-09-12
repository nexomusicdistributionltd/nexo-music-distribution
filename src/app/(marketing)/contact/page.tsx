import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/marketing/PageHero";
import { Section, Eyebrow } from "@/components/marketing/Section";
import { ContactForm } from "@/components/marketing/ContactForm";
import { Button } from "@/components/ui/Button";
import { SITE_URL, COMPANY_LEGAL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact NEXO Music Distribution about distribution, publishing, pricing, or label partnerships.",
  alternates: { canonical: `${SITE_URL}/contact` },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk with Nexo"
        description="Ask about distribution, Nexo Publishing Group, pricing, or label operations. The form UI is complete; delivery requires backend configuration."
        crumbs={[{ label: "Home", href: "/" }, { label: "Contact" }]}
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <Eyebrow>Reach us</Eyebrow>
            <h2 className="mt-3 text-h2">{COMPANY_LEGAL}</h2>
            <p className="mt-3 text-body text-[var(--nexo-text-muted)]">
              Public website:{" "}
              <a
                href={SITE_URL}
                className="underline underline-offset-4 hover:text-[var(--nexo-text)]"
                rel="noopener noreferrer"
              >
                nexomusicdistribution.com
              </a>
            </p>
            <p className="mt-4 text-small text-[var(--nexo-text-muted)]">
              A public support email will be listed here when published. Until then, use Get
              Started to register interest, or configure form delivery in a later batch.
            </p>
            <Link href="/get-started" className="mt-6 inline-flex">
              <Button className="rounded-full">Get Started</Button>
            </Link>
          </div>
          <div className="rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 sm:p-8">
            <h2 className="text-h3">Message form</h2>
            <div className="mt-6">
              <ContactForm />
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
