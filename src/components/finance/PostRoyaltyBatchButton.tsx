"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { postRoyaltyImportBatchAction } from "@/app/admin/finance/actions";

export function PostRoyaltyBatchButton({
  batchId,
  disabled = false,
}: {
  batchId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || pending}
        onClick={async () => {
          if (!window.confirm("Match and post all eligible confirmed rows in this batch to owner royalty balances?")) return;
          setPending(true);
          setError(null);
          const result = await postRoyaltyImportBatchAction(batchId);
          setPending(false);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.refresh();
        }}
      >
        {pending ? "Posting…" : "Match & post royalties"}
      </Button>
      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  );
}
