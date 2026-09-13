"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { createPayoutAction } from "@/app/admin/finance/actions";

export function CreatePayoutForm() {
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
        const amount = Number(fd.get("amountMinor"));
        const r = await createPayoutAction({
          ownerUserId: String(fd.get("ownerUserId") || "").trim(),
          amountMinor: amount,
          currency: String(fd.get("currency") || "USD").toUpperCase(),
          method: String(fd.get("method") || "") || undefined,
          idempotencyKey: String(fd.get("idempotencyKey") || "") || undefined,
        });
        setPending(false);
        if (!r.ok) setError(r.error);
        else window.location.reload();
      }}
    >
      <Input name="ownerUserId" placeholder="owner user uuid" required />
      <Input name="amountMinor" type="number" step="1" placeholder="amount minor" required />
      <Input name="currency" defaultValue="USD" maxLength={3} required />
      <Input name="method" placeholder="method (optional)" />
      <Input name="idempotencyKey" placeholder="idempotency key" />
      <Button type="submit" size="sm" disabled={pending}>
        Create payout
      </Button>
      {error ? <span className="w-full text-caption text-red-500">{error}</span> : null}
    </form>
  );
}
