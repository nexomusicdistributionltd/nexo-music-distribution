"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { upsertHomepageSettingsAction } from "@/app/admin/website/actions";

export function HomepageSettingsClient({
  initial,
}: {
  initial: Record<string, unknown>;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    hero_eyebrow: String(initial.hero_eyebrow ?? ""),
    hero_title: String(initial.hero_title ?? ""),
    hero_title_accent: String(initial.hero_title_accent ?? ""),
    hero_body: String(initial.hero_body ?? ""),
    hero_cta_label: String(initial.hero_cta_label ?? "Get Started"),
    hero_cta_href: String(initial.hero_cta_href ?? "/get-started"),
    hero_image_url: String(initial.hero_image_url ?? ""),
    show_featured_artists: initial.show_featured_artists !== false,
    show_featured_releases: initial.show_featured_releases !== false,
    show_partners: initial.show_partners !== false,
    show_services: initial.show_services !== false,
    show_about: initial.show_about !== false,
  });

  return (
    <section className="space-y-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
      <h2 className="text-h4">Homepage</h2>
      <p className="text-caption text-[var(--nexo-text-muted)]">
        Admin-controllable hero copy and section visibility. Featured picks come from
        website_featured flags on published artists/releases.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["hero_eyebrow", "Hero eyebrow"],
            ["hero_title", "Hero title"],
            ["hero_title_accent", "Hero accent line"],
            ["hero_cta_label", "CTA label"],
            ["hero_cta_href", "CTA href"],
            ["hero_image_url", "Hero image URL"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-caption">
            {label}
            <Input
              className="mt-1"
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <label className="block text-caption">
        Hero body
        <Textarea
          className="mt-1"
          rows={4}
          value={form.hero_body}
          onChange={(e) => setForm((f) => ({ ...f, hero_body: e.target.value }))}
        />
      </label>
      <div className="flex flex-wrap gap-4 text-small">
        {(
          [
            ["show_featured_releases", "Featured releases"],
            ["show_featured_artists", "Featured artists"],
            ["show_partners", "Partners marquee"],
            ["show_services", "Services"],
            ["show_about", "About"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
            />
            {label}
          </label>
        ))}
      </div>
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await upsertHomepageSettingsAction({
              ...initial,
              ...form,
              hero_image_url: form.hero_image_url || null,
            });
            setMsg(res.ok ? "Homepage settings saved." : res.error);
          })
        }
      >
        Save homepage
      </Button>
      {msg ? <p className="text-caption text-[var(--nexo-text-muted)]">{msg}</p> : null}
    </section>
  );
}
