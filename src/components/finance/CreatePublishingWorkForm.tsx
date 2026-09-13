"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createPublishingWorkAction } from "@/app/admin/finance/actions";

export function CreatePublishingWorkForm() {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setPending(true);
        setError(null);
        const r = await createPublishingWorkAction({
          ownerUserId: String(fd.get("ownerUserId") || "").trim(),
          title: String(fd.get("title") || "").trim(),
          iswc: String(fd.get("iswc") || "") || undefined,
        });
        setPending(false);
        if (!r.ok) setError(r.error);
        else window.location.reload();
      }}
    >
      <Input name="ownerUserId" placeholder="owner user uuid" required />
      <Input name="title" placeholder="Work title" required />
      <Input name="iswc" placeholder="ISWC (optional)" />
      <Button type="submit" size="sm" disabled={pending}>
        Create work
      </Button>
      {error ? <span className="text-caption text-red-500">{error}</span> : null}
    </form>
  );
}
