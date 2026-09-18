"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import {
  reviewVerificationAction,
  saveVerificationRiskNotesAction,
} from "@/app/admin/verifications/actions";

export function VerificationReviewControls({
  verificationId,
  initialRiskNotes,
}: {
  verificationId: string;
  initialRiskNotes: string | null;
}) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [riskNotes, setRiskNotes] = React.useState(initialRiskNotes ?? "");
  const [pending, setPending] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  async function decide(
    status: "under_review" | "verified" | "declined" | "additional_information_required"
  ) {
    setPending(status);
    setMessage(null);
    const result = await reviewVerificationAction({
      verificationId,
      status,
      reason,
    });
    setPending(null);
    if (!result.ok) {
      setMessage({ ok: false, text: result.error });
      return;
    }
    setMessage({ ok: true, text: "Verification updated." });
    setReason("");
    router.refresh();
  }

  async function saveNotes() {
    setPending("notes");
    setMessage(null);
    const result = await saveVerificationRiskNotesAction({
      verificationId,
      riskNotes,
    });
    setPending(null);
    setMessage(
      result.ok
        ? { ok: true, text: "Internal risk notes saved." }
        : { ok: false, text: result.error }
    );
    if (result.ok) router.refresh();
  }

  return (
    <div className="space-y-5">
      {message ? (
        <Alert variant={message.ok ? "success" : "error"}>{message.text}</Alert>
      ) : null}

      <div className="space-y-2">
        <label className="text-label" htmlFor="verification-reason">
          Decision reason / additional information request
        </label>
        <textarea
          id="verification-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          maxLength={4000}
          className="w-full rounded-[var(--nexo-radius)] border border-[var(--nexo-input-border)] bg-[var(--nexo-input-bg)] p-3 text-small text-[var(--nexo-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-ring)]"
          placeholder="Required when declining or requesting additional information."
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={Boolean(pending)}
          onClick={() => decide("under_review")}
        >
          {pending === "under_review" ? "Updating…" : "Mark under review"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={Boolean(pending)}
          onClick={() => decide("additional_information_required")}
        >
          {pending === "additional_information_required" ? "Updating…" : "Require information"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={Boolean(pending)}
          onClick={() => decide("declined")}
        >
          {pending === "declined" ? "Updating…" : "Decline"}
        </Button>
        <Button
          type="button"
          disabled={Boolean(pending)}
          onClick={() => decide("verified")}
        >
          {pending === "verified" ? "Verifying…" : "Mark verified"}
        </Button>
      </div>

      <div className="border-t border-[var(--nexo-divider)] pt-5">
        <label className="text-label" htmlFor="risk-notes">
          Internal risk / fraud notes
        </label>
        <textarea
          id="risk-notes"
          value={riskNotes}
          onChange={(e) => setRiskNotes(e.target.value)}
          rows={5}
          maxLength={8000}
          className="mt-2 w-full rounded-[var(--nexo-radius)] border border-[var(--nexo-input-border)] bg-[var(--nexo-input-bg)] p-3 text-small text-[var(--nexo-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-ring)]"
          placeholder="Admin-only notes. Never visible to the artist or label."
        />
        <Button
          type="button"
          className="mt-2"
          variant="outline"
          disabled={Boolean(pending)}
          onClick={saveNotes}
        >
          {pending === "notes" ? "Saving…" : "Save internal notes"}
        </Button>
      </div>
    </div>
  );
}
