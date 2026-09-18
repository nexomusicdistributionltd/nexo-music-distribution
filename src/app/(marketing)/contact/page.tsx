import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/marketing/PageHero";
import { Section, Eyebrow } from "@/components/marketing/Section";
import { ContactForm } from "@/components/marketing/ContactForm";
import { Button } from "@/components/ui/Button";
import { SITE_URL, COMPANY_LEGAL } from "@/lib/site";
import { LEGAL_CONTACT_EMAIL, LEGAL_INQUIRIES_EMAIL } from "@/lib/legal/copy";
import { SafeHtml } from "@/components/cms/SafeHtml";
import { getPublishedPageBySlug } from "@/lib/cms/pages";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact NEXO Music Distribution about distribution, publishing, pricing, or label partnerships.",
  alternates: { canonical: `${SITE_URL}/contact` },
};

export default async function Page() {
  const cmsPage = await getPublishedPageBySlug("contact");
  const hasCmsBody = Boolean(cmsPage?.body_html?.trim());

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title={cmsPage?.title || "Talk with Nexo"}
        description={
          cmsPage?.seo_description ||
          "Ask about distribution, Nexo Publishing Group, pricing, or label operations. Messages go through the contact form."
        }
        crumbs={[{ label: "Home", href: "/" }, { label: "Contact" }]}
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            {hasCmsBody ? (
              <SafeHtml
                html={cmsPage!.body_html}
                className="prose prose-neutral dark:prose-invert max-w-none"
              />
            ) : (
              <>
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
                  Email{" "}
                  <a
                    href={`mailto:${LEGAL_CONTACT_EMAIL}`}
                    className="underline underline-offset-4 hover:text-[var(--nexo-text)]"
                  >
                    {LEGAL_CONTACT_EMAIL}
                  </a>{" "}
                  or use the form. Additional inquiries:{" "}
                  <a
                    href={`mailto:${LEGAL_INQUIRIES_EMAIL}`}
                    className="underline underline-offset-4 hover:text-[var(--nexo-text)]"
                  >
                    {LEGAL_INQUIRIES_EMAIL}
                  </a>
                  .
                </p>
              </>
            )}
            <Link href="/get-started" className="mt-6 inline-flex">
              <Button>Get Started</Button>
            </Link>
          </div>
          <div className="border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 sm:p-8">
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
