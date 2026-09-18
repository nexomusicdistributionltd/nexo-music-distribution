"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { reviewIdentityVerificationAction } from "@/app/admin/verifications/actions";

export function IdentityReviewForm({
  verificationId,
  submissionId,
}: {
  verificationId: string;
  submissionId: string;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState<"under_review" | "verified" | "declined" | "additional_info_required">("under_review");
  const [reason, setReason] = React.useState("");
  const [adminNote, setAdminNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await reviewIdentityVerificationAction({
        verificationId,
        submissionId,
        status,
        reason,
        adminNote,
      });
      if (!result.ok) {
        setMessage({ kind: "error", text: result.error });
        return;
      }
      setMessage({ kind: "ok", text: "Verification review saved." });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4">
      <h2 className="text-h4">Review decision</h2>
      {message ? <Alert variant={message.kind === "ok" ? "success" : "error"}>{message.text}</Alert> : null}
      <label className="block space-y-1.5">
        <span className="text-label">Status</span>
        <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="under_review">Under review</option>
          <option value="verified">Verified</option>
          <option value="additional_info_required">Require additional information</option>
          <option value="declined">Declined</option>
        </Select>
      </label>
      <label className="block space-y-1.5">
        <span className="text-label">Reason {status === "declined" || status === "additional_info_required" ? "(required)" : "(optional)"}</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-bg)] px-3 py-2 text-small"
          placeholder="User-visible reason"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-label">Internal note</span>
        <textarea
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          rows={3}
          className="w-full rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-bg)] px-3 py-2 text-small"
          placeholder="Internal review note"
        />
      </label>
      <Button type="button" onClick={() => void submit()} disabled={busy}>
        {busy ? "Saving…" : "Save review"}
      </Button>
    </div>
  );
}
