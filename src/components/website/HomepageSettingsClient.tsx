"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { upsertHomepageSettingsAction } from "@/app/admin/website/actions";
import { uploadCmsMediaAction } from "@/app/admin/website/media-actions";
import {
  HOMEPAGE_IMAGE_DEFAULTS,
  HOMEPAGE_IMAGE_KEYS,
  HOMEPAGE_IMAGE_PRESETS,
  type HomepageImageKey,
} from "@/lib/website/homepage-images";

const IMAGE_FIELD_LABELS: Record<HomepageImageKey, string> = {
  hero_image_url: "Hero image URL",
  artists_image_url: "Artists / creators image URL",
  labels_image_url: "Labels image URL",
  distribution_image_url: "Distribution / global image URL",
  royalties_image_url: "Royalties / analytics image URL",
  publishing_image_url: "Publishing image URL",
  about_image_url: "About image URL",
  cta_image_url: "CTA image URL",
};

function emptyImageForm(initial: Record<string, unknown>) {
  const out = {} as Record<HomepageImageKey, string>;
  for (const key of HOMEPAGE_IMAGE_KEYS) {
    out[key] = String(initial[key] ?? "");
  }
  return out;
}

export function HomepageSettingsClient({
  initial,
}: {
  initial: Record<string, unknown>;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<HomepageImageKey | null>(null);
  const [form, setForm] = useState({
    hero_eyebrow: String(initial.hero_eyebrow ?? ""),
    hero_title: String(initial.hero_title ?? ""),
    hero_title_accent: String(initial.hero_title_accent ?? ""),
    hero_body: String(initial.hero_body ?? ""),
    hero_cta_label: String(initial.hero_cta_label ?? "Get Started"),
    hero_cta_href: String(initial.hero_cta_href ?? "/get-started"),
    ...emptyImageForm(initial),
    show_featured_artists: initial.show_featured_artists !== false,
    show_featured_releases: initial.show_featured_releases !== false,
    show_partners: initial.show_partners !== false,
    show_services: initial.show_services !== false,
    show_about: initial.show_about !== false,
  });

  async function onUpload(key: HomepageImageKey, file: File | null) {
    if (!file) return;
    setUploadingKey(key);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadCmsMediaAction(fd);
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      const url = res.data?.publicUrl;
      if (url) setForm((f) => ({ ...f, [key]: url }));
      setMsg(`Uploaded for ${IMAGE_FIELD_LABELS[key]}. Remember to save.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploadingKey(null);
    }
  }

  return (
    <section className="space-y-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
      <h2 className="text-h4">Homepage</h2>
      <p className="text-caption text-[var(--nexo-text-muted)]">
        Admin-controllable hero copy, section imagery, and visibility. Empty image URLs
        fall back to local premium presets ({Object.values(HOMEPAGE_IMAGE_PRESETS).join(", ")}).
        Featured picks come from website_featured flags on published artists/releases.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["hero_eyebrow", "Hero eyebrow"],
            ["hero_title", "Hero title"],
            ["hero_title_accent", "Hero accent line"],
            ["hero_cta_label", "CTA label"],
            ["hero_cta_href", "CTA href"],
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

      <div className="space-y-3 border-t border-[var(--nexo-divider)] pt-4">
        <h3 className="text-label">Section images</h3>
        <p className="text-caption text-[var(--nexo-text-muted)]">
          Paste a CMS / CDN URL or upload into cms-media. Leave blank to use the listed local fallback.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {HOMEPAGE_IMAGE_KEYS.map((key) => {
            const preset = HOMEPAGE_IMAGE_DEFAULTS[key];
            return (
              <div key={key} className="space-y-2 rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3">
                <label className="block text-caption">
                  {IMAGE_FIELD_LABELS[key]}
                  <span className="mt-0.5 block text-[var(--nexo-text-muted)]">
                    Fallback: {HOMEPAGE_IMAGE_PRESETS[preset]}
                  </span>
                  <Input
                    className="mt-1"
                    value={form[key]}
                    placeholder={HOMEPAGE_IMAGE_PRESETS[preset]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-caption text-[var(--nexo-text-muted)]">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="text-caption"
                    disabled={pending || uploadingKey === key}
                    onChange={(e) => onUpload(key, e.target.files?.[0] ?? null)}
                  />
                  {uploadingKey === key ? "Uploading…" : "Upload"}
                </label>
              </div>
            );
          })}
        </div>
      </div>

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
        disabled={pending || uploadingKey != null}
        onClick={() =>
          start(async () => {
            const imagePayload = Object.fromEntries(
              HOMEPAGE_IMAGE_KEYS.map((k) => [k, form[k]?.trim() ? form[k].trim() : null])
            );
            const res = await upsertHomepageSettingsAction({
              ...initial,
              ...form,
              ...imagePayload,
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
