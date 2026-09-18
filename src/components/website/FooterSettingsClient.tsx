"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { upsertFooterSettingsAction } from "@/app/admin/website/actions";

type LinkItem = { label: string; href: string };

function linksToText(value: unknown, fallback: LinkItem[]) {
  if (!Array.isArray(value)) return fallback.map((item) => `${item.label}|${item.href}`).join("\n");
  return value
    .filter((item): item is LinkItem => Boolean(item && typeof item === "object"))
    .map((item) => `${String(item.label ?? "")}|${String(item.href ?? "")}`)
    .filter((line) => line !== "|")
    .join("\n");
}

function textToLinks(value: string): LinkItem[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const pipe = line.indexOf("|");
      if (pipe < 1) return null;
      const label = line.slice(0, pipe).trim();
      const href = line.slice(pipe + 1).trim();
      if (!label || !href) return null;
      return { label, href };
    })
    .filter((item): item is LinkItem => Boolean(item));
}

const DEFAULT_SERVICES = [
  { label: "Distribution", href: "/distribution" },
  { label: "Publishing", href: "/publishing" },
  { label: "Services", href: "/services" },
  { label: "For Artists", href: "/artists" },
  { label: "For Labels", href: "/labels" },
];

const DEFAULT_COMPANY = [
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Contact", href: "/contact" },
  { label: "Pricing", href: "/pricing" },
];

const DEFAULT_GET_STARTED = [
  { label: "Apply now", href: "/register" },
  { label: "Sign in", href: "/login" },
  { label: "Get Started", href: "/get-started" },
  { label: "Support", href: "/faq" },
];

const DEFAULT_LEGAL = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Refund Policy", href: "/refund-policy" },
  { label: "Cookie Policy", href: "/cookies" },
];

const DEFAULT_BOTTOM = [
  { label: "Terms", href: "/terms" },
  { label: "Contact", href: "/contact" },
];

export function FooterSettingsClient({ initial }: { initial: Record<string, unknown> }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    brand_text: String(initial.brand_text ?? ""),
    contact_email: String(initial.contact_email ?? ""),
    inquiries_email: String(initial.inquiries_email ?? ""),
    website_url: String(initial.website_url ?? ""),
    services_links: linksToText(initial.services_links, DEFAULT_SERVICES),
    company_links: linksToText(initial.company_links, DEFAULT_COMPANY),
    get_started_links: linksToText(initial.get_started_links, DEFAULT_GET_STARTED),
    legal_links: linksToText(initial.legal_links, DEFAULT_LEGAL),
    bottom_links: linksToText(initial.bottom_links, DEFAULT_BOTTOM),
  });

  const save = () =>
    start(async () => {
      const result = await upsertFooterSettingsAction({
        brand_text: form.brand_text.trim() || null,
        contact_email: form.contact_email.trim() || null,
        inquiries_email: form.inquiries_email.trim() || null,
        website_url: form.website_url.trim() || null,
        services_links: textToLinks(form.services_links),
        company_links: textToLinks(form.company_links),
        get_started_links: textToLinks(form.get_started_links),
        legal_links: textToLinks(form.legal_links),
        bottom_links: textToLinks(form.bottom_links),
      });
      setMessage(result.ok ? "Footer saved and published live." : result.error);
    });

  return (
    <section className="space-y-5 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
      <div>
        <h2 className="text-h4">Footer content</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          These values publish directly to the public website footer. Use one link per line as Label|/path or Label|https://example.com.
        </p>
      </div>

      <label className="block text-caption">
        Company description
        <Textarea
          className="mt-1"
          rows={4}
          value={form.brand_text}
          onChange={(e) => setForm((f) => ({ ...f, brand_text: e.target.value }))}
          placeholder="NEXO MUSIC DISTRIBUTION LTD — digital music distribution..."
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-caption">
          Contact email
          <Input
            className="mt-1"
            value={form.contact_email}
            onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
          />
        </label>
        <label className="text-caption">
          Inquiries email
          <Input
            className="mt-1"
            value={form.inquiries_email}
            onChange={(e) => setForm((f) => ({ ...f, inquiries_email: e.target.value }))}
          />
        </label>
        <label className="text-caption">
          Public website URL
          <Input
            className="mt-1"
            value={form.website_url}
            onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))}
          />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {([
          ["services_links", "Services links"],
          ["company_links", "Company links"],
          ["get_started_links", "Get started links"],
          ["legal_links", "Legal links"],
          ["bottom_links", "Bottom links"],
        ] as const).map(([key, label]) => (
          <label key={key} className="text-caption">
            {label}
            <Textarea
              className="mt-1 font-mono text-caption"
              rows={6}
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            />
          </label>
        ))}
      </div>

      <Button disabled={pending} onClick={save}>
        {pending ? "Publishing…" : "Save & publish footer"}
      </Button>
      {message ? <p className="text-caption text-[var(--nexo-text-muted)]">{message}</p> : null}
    </section>
  );
}
