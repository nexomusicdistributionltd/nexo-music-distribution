"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { processQueuedEmailEventsAction } from "@/app/admin/emails/actions";

export function ProcessOutboxButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await processQueuedEmailEventsAction();
        })
      }
    >
      {pending ? "Processing…" : "Process queued"}
    </Button>
  );
}
