"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { postRoyaltyImportBatchAction } from "@/app/admin/finance/actions";

export function PostRoyaltyBatchButton({
  batchId,
  disabled = false,
}: {
  batchId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await postRoyaltyImportBatchAction(batchId);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" onClick={() => void run()} disabled={disabled || busy}>
        {busy ? "Posting…" : "Match & post"}
      </Button>
      {message ? <p className="max-w-xs text-right text-[0.65rem] text-[var(--nexo-error)]">{message}</p> : null}
    </div>
  );
}
