"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import {
  bulkClaimQc,
  claimQcItem,
  releaseQcClaim,
  setQcPriority,
} from "@/app/admin/actions";

export function QcQueueActions({
  items,
  single = false,
}: {
  items: string[];
  single?: boolean;
}) {
  const [pending, setPending] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setPending(true);
    setMsg(null);
    try {
      await fn();
      window.location.reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
      setPending(false);
    }
  }

  if (single && items[0]) {
    const id = items[0];
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await claimQcItem(id);
              if (!r.ok) throw new Error(r.error);
            })
          }
        >
          Claim
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await releaseQcClaim(id);
              if (!r.ok) throw new Error(r.error);
            })
          }
        >
          Release
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await setQcPriority(id, "high");
              if (!r.ok) throw new Error(r.error);
            })
          }
        >
          High priority
        </Button>
        {msg ? <span className="text-caption text-[var(--nexo-danger)]">{msg}</span> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending || items.length === 0}
        onClick={() =>
          run(async () => {
            const r = await bulkClaimQc(items);
            if (!r.ok) throw new Error(r.error);
            setMsg(`Claimed ${r.data.claimed}; failed ${r.data.failed.length}`);
          })
        }
      >
        Safe bulk claim (max 25)
      </Button>
      {msg ? <span className="text-caption">{msg}</span> : null}
    </div>
  );
}
