import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { SocialLinks } from "@/components/layout/SocialLinks";
import { NewsletterForm } from "@/components/newsletter/NewsletterForm";
import { COMPANY_LEGAL, PUBLISHING_DIVISION, SITE_URL } from "@/lib/site";
import { LEGAL_CONTACT_EMAIL, LEGAL_INQUIRIES_EMAIL } from "@/lib/legal/copy";

const SERVICES = [
  { href: "/distribution", label: "Distribution" },
  { href: "/publishing", label: "Publishing" },
  { href: "/services", label: "Services" },
  { href: "/artists", label: "For Artists" },
  { href: "/labels", label: "For Labels" },
];

const COMPANY = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/contact", label: "Contact" },
  { href: "/pricing", label: "Pricing" },
];

const GET_STARTED = [
  { href: "/register", label: "Apply now" },
  { href: "/login", label: "Sign in" },
  { href: "/get-started", label: "Get Started" },
  { href: "/faq", label: "Support" },
];

const LEGAL = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/refund-policy", label: "Refund Policy" },
  { href: "/cookies", label: "Cookie Policy" },
];

export function Footer() {
  const year = new Date().getFullYear();
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
            {SERVICES.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Company</h3>
          <ul className="space-y-2">
            {COMPANY.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
            {LEGAL.filter((l) => !COMPANY.some((c) => c.href === l.href)).map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Get started</h3>
          <ul className="space-y-2">
            {GET_STARTED.map((l) => (
              <li key={l.href}>
                <Link href={l.href}>{l.label}</Link>
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
        <p className="flex gap-4">
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
        </p>
      </div>
    </footer>
  );
}
