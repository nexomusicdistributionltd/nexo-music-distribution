import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { SocialLinks } from "@/components/layout/SocialLinks";
import { NewsletterForm } from "@/components/newsletter/NewsletterForm";
import { COMPANY_LEGAL, PUBLISHING_DIVISION, SITE_URL } from "@/lib/site";
import { PADDLE_VERIFICATION_LINKS } from "@/lib/legal/public-links";

const COMPANY = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/get-started", label: "Get Started" },
  { href: "/faq", label: "FAQ" },
];

const DISTRIBUTION = [
  { href: "/distribution", label: "Overview" },
  { href: "/services", label: "Services" },
  { href: "/artists", label: "For Artists" },
  { href: "/labels", label: "For Labels" },
];

const PUBLISHING = [
  { href: "/publishing", label: "Nexo Publishing Group" },
  { href: "/publishing#sync", label: "Sync Licensing" },
  { href: "/publishing#mechanical", label: "Mechanical Royalties" },
  { href: "/publishing#creative", label: "Creative Services" },
];

const RESOURCES = [
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/blog", label: "Blog" },
  { href: "/music", label: "Music" },
  { href: "/login", label: "Login" },
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
    <footer className="mt-auto border-t border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-12 lg:px-8">
        <div className="lg:col-span-4">
          <Logo height={40} />
          <p className="mt-4 max-w-sm text-small text-[var(--nexo-text-muted)]">
            {COMPANY_LEGAL} — digital music distribution, publishing, and royalty
            management for artists and labels.
          </p>
          <p className="mt-3 text-caption uppercase tracking-[0.12em] text-[var(--nexo-text-secondary)]">
            Publishing division: {PUBLISHING_DIVISION}
          </p>
          <p className="mt-4 text-small">
            <a
              href={SITE_URL}
              className="text-[var(--nexo-text-muted)] hover:text-[var(--nexo-text)]"
              rel="noopener noreferrer"
            >
              nexomusicdistribution.com
            </a>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-5 lg:grid-cols-3">
          <div>
            <h3 className="text-label text-[var(--nexo-text)]">Company</h3>
            <ul className="mt-3 space-y-2">
              {COMPANY.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-small text-[var(--nexo-text-muted)] hover:text-[var(--nexo-text)]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-label text-[var(--nexo-text)]">Distribution</h3>
            <ul className="mt-3 space-y-2">
              {DISTRIBUTION.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-small text-[var(--nexo-text-muted)] hover:text-[var(--nexo-text)]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <h3 className="mt-6 text-label text-[var(--nexo-text)]">Publishing</h3>
            <ul className="mt-3 space-y-2">
              {PUBLISHING.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-small text-[var(--nexo-text-muted)] hover:text-[var(--nexo-text)]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-label text-[var(--nexo-text)]">Resources</h3>
            <ul className="mt-3 space-y-2">
              {RESOURCES.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-small text-[var(--nexo-text-muted)] hover:text-[var(--nexo-text)]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <h3 className="mt-6 text-label text-[var(--nexo-text)]">Legal</h3>
            <ul className="mt-3 space-y-2">
              {LEGAL.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-small text-[var(--nexo-text-muted)] hover:text-[var(--nexo-text)]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lg:col-span-3">
          <h3 className="text-label text-[var(--nexo-text)]">Newsletter</h3>
          <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
            Release notes, catalog highlights, and publishing updates.
          </p>
          <NewsletterForm source="footer" />
          <div className="mt-6">
            <h3 className="text-label text-[var(--nexo-text)]">Social</h3>
            <SocialLinks className="mt-3" />
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--nexo-divider)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-caption text-[var(--nexo-text-muted)] sm:px-6 lg:px-8">
          <nav aria-label="Pricing and legal" className="flex flex-wrap gap-x-5 gap-y-2">
            {PADDLE_VERIFICATION_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-[var(--nexo-text-muted)] underline-offset-4 hover:text-[var(--nexo-text)] hover:underline"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {year} {COMPANY_LEGAL}. All rights reserved.
            </p>
            <p>Digital distribution · Publishing · Royalty management</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
