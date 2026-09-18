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

  function run(decision: "request_changes" | "reject") {
    setError(null);
    startTransition(async () => {
      const result = await postApprovalReviewAction({ releaseId, decision, reason });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="space-y-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
      <div>
        <h2 className="text-h4">Post-approval review</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          Before delivery is queued, send an approved release back for corrections or reject it.
          The account owner receives the normal release-status notification/email.
        </p>
      </div>
      <label className="block space-y-1.5">
        <span className="text-label">Artist / label visible reason</span>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          placeholder="Explain exactly what needs to be corrected or why the release is rejected."
        />
      </label>
      {error ? <Alert variant="warning" title="Cannot update release">{error}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} variant="secondary" onClick={() => run("request_changes")}>
          {pending ? "Processing…" : "Request additional information"}
        </Button>
        <Button disabled={pending} variant="secondary" onClick={() => run("reject")}>
          Reject release
        </Button>
      </div>
    </section>
  );
}
