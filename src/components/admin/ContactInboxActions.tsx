"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { updateContactStatusAction } from "@/app/admin/actions";

export function ContactInboxActions({ id, status }: { id: string; status: string }) {
  const [pending, setPending] = React.useState(false);
  async function set(next: string) {
    setPending(true);
    await updateContactStatusAction({ id, status: next });
    window.location.reload();
  }
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "triaged" ? (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => set("triaged")}>
          Triage
        </Button>
      ) : null}
      {status !== "replied" ? (
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => set("replied")}>
          Mark replied
        </Button>
      ) : null}
      {status !== "closed" ? (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => set("closed")}>
          Close
        </Button>
      ) : null}
    </div>
  );
}
