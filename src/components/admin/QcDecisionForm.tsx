"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import { QC_CHECKLIST_KEYS, type QcChecklist, type QcDecision } from "@/lib/admin/qc";
import { performQcDecisionAction } from "@/app/admin/actions";

const LABELS: Record<(typeof QC_CHECKLIST_KEYS)[number], string> = {
  metadata_complete: "Metadata complete & accurate",
  artwork_ok: "Artwork meets specs",
  audio_ok: "Audio quality / sync OK",
  rights_cleared: "Rights / contributors look clear",
  territories_ok: "Territories / distribution settings OK",
  explicit_flagged: "Explicit content correctly flagged",
  isrc_upc_format: "ISRC / UPC format OK (when provided)",
  no_policy_violation: "No policy violations",
};

export function QcDecisionForm({ releaseId }: { releaseId: string }) {
  const router = useRouter();
  const [checklist, setChecklist] = React.useState<QcChecklist>({});
  const [reason, setReason] = React.useState("");
  const [internal, setInternal] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<{ kind: "success" | "warning"; title: string; text: string } | null>(null);
  const [pending, setPending] = React.useState(false);

  async function run(decision: QcDecision) {
    setPending(true);
    setError(null);
    setNotice(null);
    const res = await performQcDecisionAction({
      releaseId,
      decision,
      checklist,
      artistVisibleReason: reason,
      internalNote: internal,
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (decision === "approve") {
      if (res.data.distribution?.returnedForChanges) {
        setNotice({
          kind: "warning",
          title: "Declined — returned for changes",
          text:
            res.data.distributionWarning ??
            "The release was returned to the artist or label for correction and can be edited and resubmitted.",
        });
      } else if (res.data.distributionWarning) {
        setNotice({
          kind: "warning",
          title: "Approved — distribution needs attention",
          text: res.data.distributionWarning,
        });
      } else {
        setNotice({
          kind: "success",
          title: "Distribution started",
          text: "Release approved and submitted to TooLost for distribution. Delivery status will continue syncing automatically.",
        });
      }
    }
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-5">
      <h2 className="text-h4">QC decision</h2>
      <ul className="space-y-2">
        {QC_CHECKLIST_KEYS.map((key) => (
          <li key={key}>
            <label className="flex items-start gap-2 text-small">
              <input
                type="checkbox"
                className="mt-1"
                checked={checklist[key] === true}
                onChange={(e) =>
                  setChecklist((c) => ({ ...c, [key]: e.target.checked }))
                }
              />
              <span>{LABELS[key]}</span>
            </label>
          </li>
        ))}
      </ul>
      <label className="block space-y-1.5">
        <span className="text-label">Artist-visible reason</span>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Required for request changes / reject"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-label">Internal note (staff only)</span>
        <Textarea
          value={internal}
          onChange={(e) => setInternal(e.target.value)}
          rows={2}
          placeholder="Not shown to the artist"
        />
      </label>
      {error ? (
        <Alert variant="warning" title="Cannot complete QC">
          {error}
        </Alert>
      ) : null}
      {notice ? (
        <Alert
          variant={notice.kind === "success" ? "success" : "warning"}
          title={notice.title}
        >
          {notice.text}
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => run("approve")}>
          {pending ? "Processing…" : "Approve"}
        </Button>
        <Button
          disabled={pending}
          variant="secondary"
          onClick={() => run("request_changes")}
        >
          Decline & return for changes
        </Button>
        <Button
          disabled={pending}
          variant="secondary"
          onClick={() => run("reject")}
        >
          Reject permanently
        </Button>
      </div>
    </div>
  );
}
