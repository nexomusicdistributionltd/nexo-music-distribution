"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { publishStatementAction } from "@/app/admin/finance/actions";

export function PublishStatementForm() {
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-2 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setPending(true);
        setError(null);
        const r = await publishStatementAction({
          ownerUserId: String(fd.get("ownerUserId") || "").trim(),
          periodStart: String(fd.get("periodStart") || ""),
          periodEnd: String(fd.get("periodEnd") || ""),
          currency: String(fd.get("currency") || "USD").toUpperCase(),
        });
        setPending(false);
        if (!r.ok) setError(r.error);
        else window.location.reload();
      }}
    >
      <Input name="ownerUserId" placeholder="owner user uuid" required />
      <Input name="periodStart" type="date" required />
      <Input name="periodEnd" type="date" required />
      <Input name="currency" placeholder="USD" defaultValue="USD" maxLength={3} required />
      <Button type="submit" size="sm" disabled={pending}>
        Publish from ledger
      </Button>
      {error ? <span className="text-caption text-red-500">{error}</span> : null}
    </form>
  );
}
