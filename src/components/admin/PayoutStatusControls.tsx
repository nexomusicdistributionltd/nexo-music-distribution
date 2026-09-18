"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { updatePayoutStatusAction } from "@/app/admin/actions";
import {
  completePayoutPaidAction,
  processPayoutWithProviderAction,
} from "@/app/admin/finance/actions";
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
      {status === "processing" ? (
        <>
          <Input
            className="h-8 w-48"
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder="Real payment reference"
          />
          <Button
            size="sm"
            disabled={pending || paymentReference.trim().length < 3}
            onClick={async () => {
              setPending(true);
              setError(null);
              const r = await completePayoutPaidAction({
                payoutId,
                paymentReference: paymentReference.trim(),
                providerName: "manual",
              });
              setPending(false);
              if (!r.ok) setError(r.error);
              else {
                setPaymentReference("");
                router.refresh();
              }
            }}
          >
            Record paid
          </Button>
        </>
      ) : null}
      {error ? <span className="text-caption text-red-500">{error}</span> : null}
    </div>
  );
}
