"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import { postApprovalReviewAction } from "@/app/admin/releases/[releaseId]/actions";

export function PostApprovalReviewForm({ releaseId }: { releaseId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function returnForChanges() {
    setError(null);
    startTransition(async () => {
      const result = await postApprovalReviewAction({ releaseId, reason });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReason("");
      router.refresh();
    });
  }

  return (
    <section className="space-y-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
      <div>
        <h2 className="text-h4">Decline release & return for correction</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          Use this while the release is approved or still waiting in Nexo’s delivery queue. Nexo
          changes the user-facing status to Declined, cancels any safe queued job, makes the release
          editable again in the artist or label dashboard, shows your decline reason to the account
          owner, and lets them resubmit it to QC.
        </p>
      </div>

      <Alert variant="warning" title="Pre-delivery correction">
        This is a pre-delivery correction action. Once TooLost submission has started or a TooLost
        release ID exists, this action is blocked and the provider edit/takedown workflow must be used.
      </Alert>

      <label className="block space-y-1.5">
        <span className="text-label">Reason shown to artist / label</span>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          placeholder="Explain exactly what must be corrected, replaced, or clarified before approval."
        />
      </label>

      {error ? <Alert variant="warning" title="Cannot return release">{error}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending || !reason.trim()}
          variant="secondary"
          onClick={returnForChanges}
        >
          {pending ? "Returning release…" : "Decline & return for changes"}
        </Button>
      </div>
    </section>
  );
}
