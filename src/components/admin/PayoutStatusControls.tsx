"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { updatePayoutStatusAction } from "@/app/admin/actions";
import { allowedPayoutTransitions, type PayoutStatus } from "@/lib/finance/money";

export function PayoutStatusControls({
  payoutId,
  status,
}: {
  payoutId: string;
  status: PayoutStatus;
}) {
  const next = allowedPayoutTransitions(status).filter((s) => s !== "paid");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  if (status === "paid") {
    return <span className="text-caption text-[var(--nexo-text-muted)]">Paid (immutable)</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {next.map((s) => (
        <Button
          key={s}
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setError(null);
            const r = await updatePayoutStatusAction({ payoutId, status: s });
            setPending(false);
            if (!r.ok) setError(r.error);
            else window.location.reload();
          }}
        >
          Mark {s}
        </Button>
      ))}
      <Button size="sm" variant="ghost" disabled title="Requires real payment operation">
        Mark paid (disabled)
      </Button>
      {error ? <span className="text-caption text-red-500">{error}</span> : null}
    </div>
  );
}
