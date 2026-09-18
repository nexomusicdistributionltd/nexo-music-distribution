"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  upsertPartnerAction,
  deletePartnerAction,
} from "@/app/admin/website/actions";
import { uploadCmsMediaAction } from "@/app/admin/website/media-actions";
import type { WebsitePartner } from "@/lib/website/partner-types";

export function PartnersAdminClient({ partners }: { partners: WebsitePartner[] }) {
  const [form, setForm] = useState({
    name: "",
    logoUrl: "",
    websiteUrl: "",
    sortOrder: "0",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);

  async function uploadNewLogo(file: File | null) {
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      const data = new FormData();
      data.set("file", file);
      const result = await uploadCmsMediaAction(data);
      if (!result.ok) {
        setMsg(result.error);
        return;
      }
      setForm((value) => ({
        ...value,
        logoUrl: result.data?.publicUrl ?? value.logoUrl,
      }));
      setMsg("Logo uploaded to Nexo CMS media. Save the partner to publish it.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
        <div>
          <h2 className="text-h4">Add partner</h2>
          <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
            Upload partner logos into Nexo CMS media for reliable public rendering. Active partners
            appear on the homepage partner marquee immediately after save.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Partner name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            placeholder="Logo URL"
            value={form.logoUrl}
            onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
          />
          <Input
            placeholder="Partner website URL"
            value={form.websiteUrl}
            onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
          />
          <Input
            inputMode="numeric"
            placeholder="Sort order"
            value={form.sortOrder}
            onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex h-10 cursor-pointer items-center rounded-[var(--nexo-radius)] border border-dashed border-[var(--nexo-border)] px-3 text-caption text-[var(--nexo-text-muted)]">
            {uploading ? "Uploading logo…" : "Upload partner logo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              disabled={pending || uploading}
              onChange={(e) => uploadNewLogo(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button
            disabled={pending || uploading || !form.name.trim()}
            onClick={() =>
              start(async () => {
                const result = await upsertPartnerAction({
                  name: form.name,
                  logoUrl: form.logoUrl,
                  websiteUrl: form.websiteUrl,
                  sortOrder: Number(form.sortOrder) || 0,
                  isActive: true,
                });
                setMsg(result.ok ? "Partner saved and published live." : result.error);
                if (result.ok) {
                  setForm({ name: "", logoUrl: "", websiteUrl: "", sortOrder: "0" });
                }
              })
            }
          >
            Add & publish partner
          </Button>
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-h4">Partner library</h2>
          <p className="text-caption text-[var(--nexo-text-muted)]">
            {partners.length} partner{partners.length === 1 ? "" : "s"} configured.
          </p>
        </div>
        {partners.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {partners.map((partner) => (
              <PartnerEditor key={partner.id} partner={partner} onMessage={setMsg} />
            ))}
          </div>
        ) : (
          <div className="rounded-[var(--nexo-radius-lg)] border border-dashed border-[var(--nexo-border)] p-8 text-center text-small text-[var(--nexo-text-muted)]">
            No partners configured yet.
          </div>
        )}
      </section>

      {msg ? <p className="text-caption text-[var(--nexo-text-muted)]">{msg}</p> : null}
    </div>
  );
}

function PartnerEditor({
  partner,
  onMessage,
}: {
  partner: WebsitePartner;
  onMessage: (message: string) => void;
}) {
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    name: partner.name,
    logoUrl: partner.logo_url || "",
    websiteUrl: partner.website_url || "",
    sortOrder: String(partner.sort_order),
  });

  async function uploadLogo(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const data = new FormData();
      data.set("file", file);
      const result = await uploadCmsMediaAction(data);
      if (!result.ok) {
        onMessage(result.error);
        return;
      }
      const logoUrl = result.data?.publicUrl ?? form.logoUrl;
      setForm((value) => ({ ...value, logoUrl }));
      const saved = await upsertPartnerAction({
        id: partner.id,
        name: form.name,
        logoUrl,
        websiteUrl: form.websiteUrl,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: partner.is_active,
      });
      onMessage(saved.ok ? "Partner logo uploaded and published." : saved.error);
    } finally {
      setUploading(false);
    }
  }

  return (
    <article className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-20 items-center justify-center overflow-hidden bg-[var(--nexo-elevated)]">
          {form.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logoUrl} alt="" className="max-h-10 max-w-[72px] object-contain" />
          ) : (
            <span className="text-caption text-[var(--nexo-text-muted)]">No logo</span>
          )}
        </div>
        <div>
          <p className="font-medium">{partner.name}</p>
          <p className="text-caption text-[var(--nexo-text-muted)]">
            {partner.is_active ? "Published live" : "Inactive"} · order {partner.sort_order}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <Input
          placeholder="Logo URL"
          value={form.logoUrl}
          onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
        />
        <Input
          placeholder="Website URL"
          value={form.websiteUrl}
          onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
        />
        <Input
          inputMode="numeric"
          value={form.sortOrder}
          onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="inline-flex h-8 cursor-pointer items-center rounded-[var(--nexo-radius)] border border-dashed border-[var(--nexo-border)] px-3 text-caption text-[var(--nexo-text-muted)]">
          {uploading ? "Uploading…" : "Replace logo"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={pending || uploading}
            onChange={(e) => uploadLogo(e.target.files?.[0] ?? null)}
          />
        </label>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending || uploading || !form.name.trim()}
          onClick={() =>
            start(async () => {
              const result = await upsertPartnerAction({
                id: partner.id,
                name: form.name,
                logoUrl: form.logoUrl,
                websiteUrl: form.websiteUrl,
                sortOrder: Number(form.sortOrder) || 0,
                isActive: partner.is_active,
              });
              onMessage(result.ok ? "Partner changes published." : result.error);
            })
          }
        >
          Save changes
        </Button>
        <Button
          size="sm"
          disabled={pending || uploading}
          onClick={() =>
            start(async () => {
              const result = await upsertPartnerAction({
                id: partner.id,
                name: form.name,
                logoUrl: form.logoUrl,
                websiteUrl: form.websiteUrl,
                sortOrder: Number(form.sortOrder) || 0,
                isActive: !partner.is_active,
              });
              onMessage(
                result.ok
                  ? partner.is_active
                    ? "Partner removed from the public website."
                    : "Partner published live."
                  : result.error
              );
            })
          }
        >
          {partner.is_active ? "Deactivate" : "Publish"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || uploading}
          onClick={() =>
            start(async () => {
              const result = await deletePartnerAction(partner.id);
              onMessage(result.ok ? "Partner deleted." : result.error);
            })
          }
        >
          Delete
        </Button>
      </div>
    </article>
  );
}
