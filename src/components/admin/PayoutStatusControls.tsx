"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { updatePayoutStatusAction } from "@/app/admin/actions";
import { completePayoutPaidAction, processPayoutWithProviderAction } from "@/app/admin/finance/actions";
import { Input } from "@/components/ui/Input";
import { allowedPayoutTransitions, type PayoutStatus } from "@/lib/finance/money";

export function PayoutStatusControls({
  payoutId,
  status,
}: {
  payoutId: string;
  status: PayoutStatus;
}) {
  const router = useRouter();
  const next = allowedPayoutTransitions(status).filter((s) => s !== "paid");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [paymentReference, setPaymentReference] = React.useState("");

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
            else router.refresh();
          }}
        >
          Mark {s}
        </Button>
      ))}
      {(status === "approved" || status === "processing") && (
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            setError(null);
            const r = await processPayoutWithProviderAction(payoutId);
            setPending(false);
            if (!r.ok) setError(r.error);
            else router.refresh();
          }}
        >
          Process via provider
        </Button>
      )}
      {(status === "approved" || status === "processing") ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder="Real payment reference"
            className="h-8 w-52"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !paymentReference.trim()}
            onClick={async () => {
              setPending(true);
              setError(null);
              const r = await completePayoutPaidAction({
                payoutId,
                paymentReference: paymentReference.trim(),
                manual: true,
              });
              setPending(false);
              if (!r.ok) setError(r.error);
              else router.refresh();
            }}
          >
            Record verified manual payment
          </Button>
        </div>
      ) : null}
      {error ? <span className="text-caption text-red-500">{error}</span> : null}
    </div>
  );
}
