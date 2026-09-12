import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { COMPANY_LEGAL, PUBLISHING_DIVISION, SITE_URL } from "@/lib/site";

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
  { href: "/login", label: "Login" },
];

const LEGAL = [
  { label: "Privacy Policy" },
  { label: "Terms of Service" },
  { label: "Cookie Policy" },
];

const SOCIAL = ["Instagram", "X", "TikTok", "YouTube", "LinkedIn", "Spotify"];

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
                <li key={l.label}>
                  <span
                    className="text-small text-[var(--nexo-text-muted)] opacity-70"
                    title="Coming soon"
                  >
                    {l.label}{" "}
                    <span className="text-caption">(soon)</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lg:col-span-3">
          <h3 className="text-label text-[var(--nexo-text)]">Newsletter</h3>
          <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
            Coming soon — subscriptions are not open yet.
          </p>
          <div className="mt-3 flex gap-2">
            <Input
              type="email"
              placeholder="Email"
              disabled
              aria-label="Newsletter email (coming soon)"
            />
            <Button type="button" disabled title="Newsletter coming soon">
              Join
            </Button>
          </div>
          <div className="mt-6">
            <h3 className="text-label text-[var(--nexo-text)]">Social</h3>
            <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
              Official profiles will be linked when published.
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {SOCIAL.map((s) => (
                <li key={s}>
                  <span
                    className="inline-flex rounded-full border border-[var(--nexo-border)] px-2.5 py-1 text-caption text-[var(--nexo-text-muted)] opacity-70"
                    title="URL not published yet"
                    aria-disabled="true"
                  >
                    {s}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--nexo-divider)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-caption text-[var(--nexo-text-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            © {year} {COMPANY_LEGAL}. All rights reserved.
          </p>
          <p>Digital distribution · Publishing · Royalty management</p>
        </div>
      </div>
    </footer>
  );
}
