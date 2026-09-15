"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  upsertPartnerAction,
  deletePartnerAction,
} from "@/app/admin/website/actions";
import type { WebsitePartner } from "@/lib/website/partner-types";

export function PartnersAdminClient({ partners }: { partners: WebsitePartner[] }) {
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-6">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          placeholder="Logo URL"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
        />
        <Input
          placeholder="Website URL"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
        />
        <Input
          placeholder="Sort order"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        />
      </div>
      <Button
        disabled={pending || !name.trim()}
        onClick={() =>
          start(async () => {
            const r = await upsertPartnerAction({
              name,
              logoUrl,
              websiteUrl,
              sortOrder: Number(sortOrder) || 0,
              isActive: true,
            });
            setMsg(r.ok ? "Partner saved." : r.error);
            if (r.ok) {
              setName("");
              setLogoUrl("");
              setWebsiteUrl("");
            }
          })
        }
      >
        Add partner
      </Button>
      <ul className="divide-y divide-[var(--nexo-border)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
        {partners.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-small"
          >
            <div>
              <p className="font-medium">
                {p.name}{" "}
                <span className="text-caption text-[var(--nexo-text-muted)]">
                  · order {p.sort_order} · {p.is_active ? "active" : "inactive"}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await upsertPartnerAction({
                      id: p.id,
                      name: p.name,
                      logoUrl: p.logo_url ?? undefined,
                      websiteUrl: p.website_url ?? undefined,
                      sortOrder: p.sort_order,
                      isActive: !p.is_active,
                    });
                    setMsg(r.ok ? "Toggled." : r.error);
                  })
                }
              >
                {p.is_active ? "Deactivate" : "Activate"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await deletePartnerAction(p.id);
                    setMsg(r.ok ? "Deleted." : r.error);
                  })
                }
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {msg ? <p className="text-caption text-[var(--nexo-text-muted)]">{msg}</p> : null}
    </div>
  );
}
