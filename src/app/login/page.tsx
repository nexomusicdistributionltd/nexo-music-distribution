import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/marketing/Section";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Login",
  description:
    "Artist and label login for NEXO Music Distribution. Authentication is not connected on this public website build.",
  alternates: { canonical: `${SITE_URL}/login` },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Account"
        title="Login"
        description="Portal authentication is not connected in this public website batch. The form below is a visual shell only — submit is disabled."
        crumbs={[{ label: "Home", href: "/" }, { label: "Login" }]}
      />
      <Section>
        <div className="mx-auto max-w-md rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 sm:p-8">
          <Alert title="Auth not connected">
            No sessions are fabricated. Artist portal, uploads, and admin tools remain out of
            scope for this public site.
          </Alert>
          <form className="mt-6 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-label">Email</span>
              <Input type="email" name="email" autoComplete="username" disabled placeholder="you@example.com" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-label">Password</span>
              <Input type="password" name="password" autoComplete="current-password" disabled placeholder="••••••••" />
            </label>
            <Button type="button" disabled className="w-full rounded-full">
              Sign in (disabled)
            </Button>
          </form>
          <p className="mt-6 text-center text-small text-[var(--nexo-text-muted)]">
            Need access?{" "}
            <Link href="/get-started" className="underline underline-offset-4 hover:text-[var(--nexo-text)]">
              Get Started
            </Link>{" "}
            or{" "}
            <Link href="/contact" className="underline underline-offset-4 hover:text-[var(--nexo-text)]">
              Contact
            </Link>
            .
          </p>
        </div>
      </Section>
    </>
  );
}
