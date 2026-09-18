"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import {
  reviewSplitShareItemAction,
  type SplitShareReviewKind,
  type SplitShareDecision,
} from "@/app/admin/splitshare/actions";

export function SplitShareReviewControls({
  kind,
  id,
  status,
}: {
  kind: SplitShareReviewKind;
  id: string;
  status: string;
}) {
  const [note, setNote] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  function run(decision: SplitShareDecision) {
    startTransition(async () => {
      setMessage(null);
      const result = await reviewSplitShareItemAction({ kind, id, decision, note });
      setMessage(result.ok ? { ok: true, text: "Updated." } : { ok: false, text: result.error });
    });
  }

  return (
    <div className="mt-3 space-y-2">
      <Textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Admin note shown to the artist or label"
      />
      {message ? <Alert variant={message.ok ? "success" : "warning"}>{message.text}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={() => run("approve")}>
          {pending ? "Saving…" : status === "approved" ? "Re-approve" : "Approve"}
        </Button>
        <Button type="button" disabled={pending} onClick={() => run("reject")}>
          Reject
        </Button>
        {kind === "recoupment" && status === "approved" ? (
          <Button type="button" disabled={pending} onClick={() => run("close")}>
            Close
          </Button>
        ) : null}
      </div>
    </div>
  );
}
