"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { reopenReleaseForCorrectionsAction } from "@/app/admin/actions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

export function ReleaseCorrectionForm({
  releaseId,
  status,
}: {
  releaseId: string;
  status: "approved" | "scheduled" | "failed";
}) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function submit() {
    if (pending) return;
    setPending(true);
    setMessage(null);
    const result = await reopenReleaseForCorrectionsAction({ releaseId, reason });
    setPending(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setReason("");
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-5">
      <div>
        <h2 className="text-h4">Reopen for corrections</h2>
        <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
          This release is {status.replace(/_/g, " ")}. Administrators can return it to Changes
          requested when a real metadata, artwork, audio, rights, or delivery issue must be fixed.
          Queued work is cancelled before the release is unlocked.
        </p>
      </div>
      <label className="block space-y-1.5">
        <span className="text-label">Artist / label visible reason</span>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          placeholder="Explain exactly what must be corrected before the release can be resubmitted."
        />
      </label>
      {message ? (
        <Alert variant="warning" title="Could not reopen release">
          {message}
        </Alert>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        disabled={pending || reason.trim().length < 4}
        aria-busy={pending}
        onClick={() => void submit()}
      >
        {pending ? "Reopening…" : "Return to changes requested"}
      </Button>
    </div>
  );
}
