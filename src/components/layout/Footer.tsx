import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { SocialLinks } from "@/components/layout/SocialLinks";
import { NewsletterForm } from "@/components/newsletter/NewsletterForm";
import { COMPANY_LEGAL, PUBLISHING_DIVISION, SITE_URL } from "@/lib/site";
import { LEGAL_CONTACT_EMAIL, LEGAL_INQUIRIES_EMAIL } from "@/lib/legal/copy";
import {
  groupFooterLinks,
  listFooterLinks,
  type FooterLink,
} from "@/lib/website/footer-links";

function FooterLinkItem({ item }: { item: FooterLink }) {
  if (item.href.startsWith("/")) {
    return (
      <Link href={item.href} target={item.new_tab ? "_blank" : undefined}>
        {item.label}
      </Link>
    );
  }
  return (
    <a
      href={item.href}
      target={item.new_tab ? "_blank" : undefined}
      rel={item.new_tab ? "noopener noreferrer" : undefined}
    >
      {item.label}
    </a>
  );
}

export async function Footer() {
  const year = new Date().getFullYear();
  const links = groupFooterLinks(await listFooterLinks());

  return (
    <footer className="pub-footer mt-auto">
      <div className="mx-auto grid max-w-[92rem] gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="pub-footer-brand">Nexo</p>
          <div className="mt-4">
            <Logo height={28} />
          </div>
          <p className="pub-body mt-5 max-w-sm">
            {COMPANY_LEGAL} — digital music distribution, publishing, and royalty management
            for independent artists and labels. Publishing division: {PUBLISHING_DIVISION}.
          </p>
          <p className="mt-4 text-small text-[var(--nexo-text-muted)]">
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>
            <br />
            Additional inquiries:{" "}
            <a href={`mailto:${LEGAL_INQUIRIES_EMAIL}`}>{LEGAL_INQUIRIES_EMAIL}</a>
            <br />
            <a href={SITE_URL} rel="noopener noreferrer">
              nexomusicdistribution.com
            </a>
          </p>
        </div>

        <div>
          <h3>Services</h3>
          <ul className="space-y-2">
            {links.services.map((item) => (
              <li key={item.id ?? `${item.section_key}:${item.href}:${item.label}`}>
                <FooterLinkItem item={item} />
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3>Company</h3>
          <ul className="space-y-2">
            {links.company.map((item) => (
              <li key={item.id ?? `${item.section_key}:${item.href}:${item.label}`}>
                <FooterLinkItem item={item} />
              </li>
            ))}
            {links.legal
              .filter((item) => !links.company.some((company) => company.href === item.href))
              .map((item) => (
                <li key={item.id ?? `${item.section_key}:${item.href}:${item.label}`}>
                  <FooterLinkItem item={item} />
                </li>
              ))}
          </ul>
        </div>

        <div>
          <h3>Get started</h3>
          <ul className="space-y-2">
            {links.get_started.map((item) => (
              <li key={item.id ?? `${item.section_key}:${item.href}:${item.label}`}>
                <FooterLinkItem item={item} />
              </li>
            ))}
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
          {links.legal.map((item) => (
            <FooterLinkItem
              key={item.id ?? `${item.section_key}:${item.href}:${item.label}`}
              item={item}
            />
          ))}
        </p>
      </div>
    </footer>
  );
}
