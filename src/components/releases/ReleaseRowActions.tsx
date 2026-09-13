"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { Input } from "@/components/ui/Input";
import {
  deleteDraftRelease,
  duplicateRelease,
  requestTakedown,
  submitRelease,
} from "@/app/(portal)/dashboard/releases/actions";
import {
  canRequestTakedown,
  canSubmit,
  isEditableStatus,
} from "@/lib/releases/status";
import type { ReleaseStatus } from "@/lib/releases/types";

export function ReleaseRowActions({
  id,
  status,
}: {
  id: string;
  status: ReleaseStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState<"submit" | "takedown" | "delete" | null>(null);
  const [takedownReason, setTakedownReason] = React.useState("");

  async function run(
    kind: string,
    fn: () => Promise<{ ok: boolean; error?: string; data?: { id?: string } }>
  ) {
    setBusy(kind);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Action failed");
        return;
      }
      if (kind === "duplicate" && res.data?.id) {
        router.push(`/dashboard/releases/${res.data.id}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/dashboard/releases/${id}`}
          className="inline-flex h-8 items-center rounded-[var(--nexo-radius)] border border-[var(--nexo-outline-border)] px-3 text-[length:0.75rem] font-medium"
        >
          View
        </Link>
        {isEditableStatus(status) ? (
          <Link
            href={`/dashboard/releases/${id}?edit=1`}
            className="inline-flex h-8 items-center px-3 text-[length:0.75rem] text-[var(--nexo-text-secondary)] hover:underline"
          >
            Edit
          </Link>
        ) : (
          <span
            className="inline-flex h-8 items-center px-3 text-[length:0.75rem] text-[var(--nexo-text-muted)] opacity-50"
            title="Locked after submit"
          >
            Edit
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={busy === "duplicate"}
          onClick={() => run("duplicate", () => duplicateRelease(id))}
        >
          Duplicate
        </Button>
        {canSubmit(status) ? (
          <Button variant="primary" size="sm" disabled={!!busy} onClick={() => setConfirm("submit")}>
            Submit
          </Button>
        ) : null}
        {canRequestTakedown(status) ? (
          <Button variant="outline" size="sm" disabled={!!busy} onClick={() => setConfirm("takedown")}>
            Request takedown
          </Button>
        ) : null}
        {status === "draft" ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={!!busy}
            onClick={() => setConfirm("delete")}
            className="text-[var(--nexo-error)]"
          >
            Delete
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-caption text-[var(--nexo-error)]">{error}</p> : null}

      <ConfirmationDialog
        open={confirm === "submit"}
        onClose={() => setConfirm(null)}
        title="Submit to QC?"
        description="This locks the release for quality control. You cannot edit until changes are requested."
        confirmLabel={busy === "submit" ? "Submitting…" : "Submit to QC"}
        confirmDisabled={busy === "submit"}
        onConfirm={() => run("submit", () => submitRelease(id))}
      />
      <ConfirmationDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        title="Delete draft?"
        description="This permanently deletes the draft and its uploaded assets."
        confirmLabel="Delete"
        destructive
        confirmDisabled={busy === "delete"}
        onConfirm={() => run("delete", () => deleteDraftRelease(id))}
      />
      <ConfirmationDialog
        open={confirm === "takedown"}
        onClose={() => setConfirm(null)}
        title="Request takedown?"
        description="Staff will review. Provider delivery takedown requires a connected provider."
        confirmLabel="Request takedown"
        destructive
        confirmDisabled={busy === "takedown" || !takedownReason.trim()}
        onConfirm={() => run("takedown", () => requestTakedown(id, takedownReason))}
      />
      {confirm === "takedown" ? (
        <Input
          placeholder="Reason for takedown (required)"
          value={takedownReason}
          onChange={(e) => setTakedownReason(e.target.value)}
        />
      ) : null}
    </div>
  );
}
