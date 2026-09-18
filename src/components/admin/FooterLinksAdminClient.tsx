"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  deleteFooterLinkAction,
  saveFooterLinkAction,
} from "@/app/admin/website/footer/actions";
import type { FooterLink } from "@/lib/website/footer-links";

const SECTIONS = [
  ["services", "Services"],
  ["company", "Company"],
  ["get_started", "Get started"],
  ["legal", "Legal"],
] as const;

export function FooterLinksAdminClient({ rows }: { rows: FooterLink[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<string | null>(null);

  const save = (form: HTMLFormElement, id?: string) => {
    const fd = new FormData(form);
    startTransition(async () => {
      const result = await saveFooterLinkAction({
        id,
        sectionKey: String(fd.get("section_key") || ""),
        label: String(fd.get("label") || ""),
        href: String(fd.get("href") || ""),
        sortOrder: Number(fd.get("sort_order") || 100),
        enabled: fd.get("enabled") === "on",
        newTab: fd.get("new_tab") === "on",
      });
      setMessage(result.ok ? "Footer link saved." : result.error);
      if (result.ok) {
        if (!id) form.reset();
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-5">
      <form
        className="grid gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 md:grid-cols-2 lg:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          save(event.currentTarget);
        }}
      >
        <Select name="section_key" defaultValue="services">
          {SECTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Input name="label" required placeholder="Link label" />
        <Input name="href" required placeholder="/page or https://..." className="lg:col-span-2" />
        <Input name="sort_order" type="number" min={0} defaultValue={100} />
        <div className="flex flex-wrap items-center gap-4 text-small lg:col-span-4">
          <label className="flex items-center gap-2"><input name="enabled" type="checkbox" defaultChecked /> Enabled</label>
          <label className="flex items-center gap-2"><input name="new_tab" type="checkbox" /> New tab</label>
        </div>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add link"}</Button>
      </form>

      {message ? <p className="text-small text-[var(--nexo-text-muted)]">{message}</p> : null}

      <div className="space-y-3">
        {rows.map((row) => (
          <form
            key={row.id ?? `${row.section_key}:${row.href}:${row.label}`}
            className="grid gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 md:grid-cols-2 lg:grid-cols-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (row.id) save(event.currentTarget, row.id);
            }}
          >
            <Select name="section_key" defaultValue={row.section_key}>
              {SECTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Input name="label" defaultValue={row.label} required />
            <Input name="href" defaultValue={row.href} required className="lg:col-span-2" />
            <Input name="sort_order" type="number" min={0} defaultValue={row.sort_order} />
            <div className="flex flex-wrap items-center gap-4 text-small lg:col-span-3">
              <label className="flex items-center gap-2"><input name="enabled" type="checkbox" defaultChecked={row.enabled} /> Enabled</label>
              <label className="flex items-center gap-2"><input name="new_tab" type="checkbox" defaultChecked={row.new_tab} /> New tab</label>
            </div>
            <Button type="submit" size="sm" disabled={pending || !row.id}>Save</Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending || !row.id}
              onClick={() => {
                if (!row.id) return;
                startTransition(async () => {
                  const result = await deleteFooterLinkAction(row.id!);
                  setMessage(result.ok ? "Footer link deleted." : result.error);
                  if (result.ok) router.refresh();
                });
              }}
            >
              Delete
            </Button>
          </form>
        ))}
      </div>
    </div>
  );
}
