"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import { postApprovalReviewAction } from "@/app/admin/releases/[releaseId]/actions";

export function PostApprovalReviewForm({
  releaseId,
  initialReason = "",
  alreadyDeclined = false,
}: {
  releaseId: string;
  initialReason?: string;
  alreadyDeclined?: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState(initialReason);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function returnForChanges() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await postApprovalReviewAction({ releaseId, reason });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(
        alreadyDeclined
          ? "Correction reason updated and sent to the artist or label."
          : "Release declined and returned for correction."
      );
      router.refresh();
    });
  }

  return (
    <section className="space-y-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
      <div>
        <h2 className="text-h4">
          {alreadyDeclined ? "Send / update correction reason" : "Decline release & return for correction"}
        </h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          {alreadyDeclined
            ? "This release is already declined and editable. Update the exact correction reason below and send it again to the affected artist or label. They can edit the release and resubmit it to QC."
            : "Enter the exact reason the release cannot be approved. Nexo will mark it Declined, return it to the affected artist or label, make it editable, send the reason by notification/email, and allow resubmission to QC."}
        </p>
      </div>

      <Alert
        variant="warning"
        title={alreadyDeclined ? "Already declined — correction can still be updated" : "Return only when the release needs artist changes"}
      >
        {alreadyDeclined
          ? "The current reason is prefilled below. Editing and sending it again updates the artist-visible reason and creates a fresh owner-only correction notification/email without changing the release out of Declined status."
          : "Use this when the artist or label must correct metadata or assets. A failed internal delivery attempt can be retried by an administrator after an internal/provider-format issue is fixed."}
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

      {error ? <Alert variant="warning" title="Cannot send correction">{error}</Alert> : null}
      {success ? <Alert variant="success" title="Correction sent">{success}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending || !reason.trim()}
          variant="secondary"
          onClick={returnForChanges}
        >
          {pending
            ? "Sending correction…"
            : alreadyDeclined
              ? "Send / update correction reason"
              : "Decline & return for changes"}
        </Button>
      </div>
    </section>
  );
}
