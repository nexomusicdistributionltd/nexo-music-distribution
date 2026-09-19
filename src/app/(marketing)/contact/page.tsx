import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/marketing/PageHero";
import { Section, Eyebrow } from "@/components/marketing/Section";
import { ContactForm } from "@/components/marketing/ContactForm";
import { Button } from "@/components/ui/Button";
import { SITE_URL, COMPANY_LEGAL } from "@/lib/site";
import { SafeHtml } from "@/components/cms/SafeHtml";
import { getPublishedPageBySlug } from "@/lib/cms/pages";
import { getWebsiteSetting } from "@/lib/website/queries";
import { DMCA_EMAIL, SUPPORT_EMAIL } from "@/lib/brand/contact";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact NEXO Music Distribution about distribution, publishing, pricing, or label partnerships.",
  alternates: { canonical: `${SITE_URL}/contact` },
};

export default async function Page() {
  const [cmsPage, footerSetting] = await Promise.all([
    getPublishedPageBySlug("contact"),
    getWebsiteSetting("footer"),
  ]);
  const hasCmsBody = Boolean(cmsPage?.body_html?.trim());
  const footerValue =
    footerSetting?.value && typeof footerSetting.value === "object" && !Array.isArray(footerSetting.value)
      ? (footerSetting.value as Record<string, unknown>)
      : {};
  const text = (value: unknown, fallback: string) =>
    typeof value === "string" && value.trim() ? value.trim() : fallback;
  const contactEmail = text(footerValue.contact_email, SUPPORT_EMAIL);
  const supportEmail = text(footerValue.support_email, SUPPORT_EMAIL);
  const dmcaEmail = text(footerValue.dmca_email, DMCA_EMAIL);
  const inquiriesEmail = text(footerValue.inquiries_email, supportEmail);

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
                <div className="mt-5 space-y-2 text-small text-[var(--nexo-text-muted)]">
                  {contactEmail !== supportEmail ? (
                    <p>
                      General contact:{" "}
                      <a
                        href={`mailto:${contactEmail}`}
                        className="underline underline-offset-4 hover:text-[var(--nexo-text)]"
                      >
                        {contactEmail}
                      </a>
                    </p>
                  ) : null}
                  <p>
                    Artist & label support:{" "}
                    <a
                      href={`mailto:${supportEmail}`}
                      className="underline underline-offset-4 hover:text-[var(--nexo-text)]"
                    >
                      {supportEmail}
                    </a>
                  </p>
                  {inquiriesEmail !== contactEmail && inquiriesEmail !== supportEmail ? (
                    <p>
                      General inquiries:{" "}
                      <a
                        href={`mailto:${inquiriesEmail}`}
                        className="underline underline-offset-4 hover:text-[var(--nexo-text)]"
                      >
                        {inquiriesEmail}
                      </a>
                    </p>
                  ) : null}
                  <p>
                    DMCA / copyright notices:{" "}
                    <a
                      href={`mailto:${dmcaEmail}`}
                      className="underline underline-offset-4 hover:text-[var(--nexo-text)]"
                    >
                      {dmcaEmail}
                    </a>
                  </p>
                </div>
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
