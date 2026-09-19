import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { SocialLinks } from "@/components/layout/SocialLinks";
import { NewsletterForm } from "@/components/newsletter/NewsletterForm";
import { COMPANY_LEGAL, PUBLISHING_DIVISION, SITE_URL } from "@/lib/site";
import { LEGAL_CONTACT_EMAIL, LEGAL_INQUIRIES_EMAIL } from "@/lib/legal/copy";
import { getWebsiteSetting } from "@/lib/website/queries";
import { DMCA_EMAIL, SUPPORT_EMAIL } from "@/lib/brand/contact";

type FooterLink = { href: string; label: string };

const SERVICES: FooterLink[] = [
  { href: "/distribution", label: "Distribution" },
  { href: "/publishing", label: "Publishing" },
  { href: "/services", label: "Services" },
  { href: "/artists", label: "For Artists" },
  { href: "/labels", label: "For Labels" },
];

const COMPANY: FooterLink[] = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/contact", label: "Contact" },
  { href: "/pricing", label: "Pricing" },
];

const GET_STARTED: FooterLink[] = [
  { href: "/register", label: "Apply now" },
  { href: "/login", label: "Sign in" },
  { href: "/get-started", label: "Get Started" },
  { href: "/faq", label: "Support" },
];

const LEGAL: FooterLink[] = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/refund-policy", label: "Refund Policy" },
  { href: "/cookies", label: "Cookie Policy" },
];

const BOTTOM: FooterLink[] = [
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
];

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function links(value: unknown, fallback: FooterLink[]): FooterLink[] {
  if (!Array.isArray(value)) return fallback;
  const safe = value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const href = typeof row.href === "string" ? row.href.trim() : "";
    const safeHref = href.startsWith("/") || /^https:\/\//i.test(href);
    return label && safeHref ? [{ label, href }] : [];
  });
  return safe.length ? safe : fallback;
}

function FooterLinks({ items }: { items: FooterLink[] }) {
  return (
    <>
      {items.map((item) => (
        <li key={`${item.label}-${item.href}`}>
          {item.href.startsWith("/") ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <a href={item.href} target="_blank" rel="noopener noreferrer">
              {item.label}
            </a>
          )}
        </li>
      ))}
    </>
  );
}

export async function Footer() {
  const year = new Date().getFullYear();
  const setting = await getWebsiteSetting("footer");
  const value = (setting?.value ?? {}) as Record<string, unknown>;

  const brandText = text(
    value.brand_text,
    `${COMPANY_LEGAL} — digital music distribution, publishing, and royalty management for independent artists and labels. Publishing division: ${PUBLISHING_DIVISION}.`
  );
  const contactEmail = text(value.contact_email, LEGAL_CONTACT_EMAIL);
  const inquiriesEmail = text(value.inquiries_email, LEGAL_INQUIRIES_EMAIL);
  const supportEmail = text(value.support_email, SUPPORT_EMAIL);
  const dmcaEmail = text(value.dmca_email, DMCA_EMAIL);
  const websiteUrl = text(value.website_url, SITE_URL);
  const services = links(value.services_links, SERVICES);
  const company = links(value.company_links, COMPANY);
  const getStarted = links(value.get_started_links, GET_STARTED);
  const legal = links(value.legal_links, LEGAL);
  const bottom = links(value.bottom_links, BOTTOM);
  const companyAndLegal = [...company, ...legal.filter((item) => !company.some((c) => c.href === item.href))];

  return (
    <footer className="pub-footer mt-auto">
      <div className="mx-auto grid max-w-[92rem] gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="pub-footer-brand">Nexo</p>
          <div className="mt-4">
            <Logo height={28} />
          </div>
          <p className="pub-body mt-5 max-w-sm">{brandText}</p>
          <p className="mt-4 text-small leading-6 text-[var(--nexo-text-muted)]">
            {contactEmail !== supportEmail ? (
              <>
                Contact: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
                <br />
              </>
            ) : null}
            Support: <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
            {inquiriesEmail !== contactEmail && inquiriesEmail !== supportEmail ? (
              <>
                <br />
                Inquiries: <a href={`mailto:${inquiriesEmail}`}>{inquiriesEmail}</a>
              </>
            ) : null}
            <br />
            DMCA: <a href={`mailto:${dmcaEmail}`}>{dmcaEmail}</a>
            <br />
            <a href={websiteUrl} rel="noopener noreferrer">
              {websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          </p>
        </div>

        <div>
          <h3>Services</h3>
          <ul className="space-y-2">
            <FooterLinks items={services} />
          </ul>
        </div>
        <div>
          <h3>Company</h3>
          <ul className="space-y-2">
            <FooterLinks items={companyAndLegal} />
          </ul>
        </div>
        <div>
          <h3>Get started</h3>
          <ul className="space-y-2">
            <FooterLinks items={getStarted} />
          </ul>
          <h3 className="mt-8">Newsletter</h3>
          <NewsletterForm source="footer" />
          <div className="mt-6">
            <SocialLinks />
          </div>
        </div>
      </div>
      <div className="mx-auto mt-12 flex max-w-[92rem] flex-col gap-2 border-t border-[var(--nexo-divider)] pt-5 text-[0.72rem] text-[var(--nexo-text-muted)] sm:flex-row sm:justify-between">
        <p>
          © {year} {COMPANY_LEGAL}. All rights reserved.
        </p>
        <p className="flex flex-wrap gap-4">
          {bottom.map((item) =>
            item.href.startsWith("/") ? (
              <Link key={`${item.label}-${item.href}`} href={item.href}>
                {item.label}
              </Link>
            ) : (
              <a
                key={`${item.label}-${item.href}`}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.label}
              </a>
            )
          )}
        </p>
      </div>
    </footer>
  );
}
