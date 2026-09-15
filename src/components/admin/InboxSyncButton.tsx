"use client";

import * as React from "react";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { syncInboxAction } from "@/app/admin/emails/actions";

export function InboxSyncButton({ imapConfigured }: { imapConfigured: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        disabled={pending || !imapConfigured}
        onClick={() =>
          start(async () => {
            setErr(null);
            setMsg(null);
            const r = await syncInboxAction();
            if (!r.ok) setErr(r.error);
            else setMsg(r.data.message);
          })
        }
      >
        {pending ? "Syncing…" : "Sync Zoho inbox"}
      </Button>
      {msg ? <p className="text-caption text-[var(--nexo-text-muted)]">{msg}</p> : null}
      {err ? <p className="text-caption text-red-400">{err}</p> : null}
    </div>
  );
}
