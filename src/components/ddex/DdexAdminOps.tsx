"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import {
  ackErnAction,
  deliverErnAction,
  generateErnAction,
  packageErnAction,
  previewErnAction,
  queueErnAction,
  retryErnAction,
  takedownErnAction,
  updateErnAction,
  validateErnAction,
  validateReleaseAction,
} from "@/app/admin/ddex/actions";
import type { DspTargetPublic } from "@/lib/ddex/types";

export function DdexAdminOps({
  releaseId,
  latestMessageId,
  targets,
}: {
  releaseId: string;
  latestMessageId?: string | null;
  targets: DspTargetPublic[];
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [ackRef, setAckRef] = React.useState("");
  const testTarget = targets.find((t) => t.isTest && t.connected) ?? targets.find((t) => t.isTest);

  async function run(fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, success: string) {
    setPending(true);
    setError(null);
    setInfo(null);
    const res = await fn();
    setPending(false);
    if (!res.ok) {
      setError(res.error ?? "Request failed.");
      return;
    }
    setInfo(success);
    window.location.reload();
  }

  async function previewXml() {
    if (!latestMessageId) return;
    setPending(true);
    setError(null);
    const res = await previewErnAction(latestMessageId);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setPreview(res.data.xml);
  }

  async function validate() {
    if (!latestMessageId) return;
    await run(() => validateErnAction(latestMessageId, releaseId), "Official XSD validation passed.");
  }

  return (
    <div className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-5">
      <h2 className="text-h4">ERN 4.3.2 operations</h2>
      <p className="text-small text-[var(--nexo-text-muted)]">
        Generate, validate, preview, package, and queue DDEX messages. The only active target is the
        isolated local test sink. Commercial DSP delivery is NOT CONNECTED. Credentials are never shown.
      </p>
      {testTarget ? (
        <p className="text-caption text-[var(--nexo-text-muted)]">
          Active target: {testTarget.displayName} · {testTarget.protocol} · ERN {testTarget.ernVersion} ·{" "}
          {testTarget.connected ? "test connected" : "NOT CONNECTED"}
        </p>
      ) : (
        <p className="text-caption text-[var(--nexo-text-muted)]">No safe test target loaded yet.</p>
      )}
      {error ? <Alert variant="error">{error}</Alert> : null}
      {info ? <Alert variant="success">{info}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => void run(() => validateReleaseAction(releaseId, testTarget?.id), "Validation stored.")}
        >
          Validate
        </Button>
        <Button
          type="button"
          onClick={() => void run(() => generateErnAction(releaseId, testTarget?.id), "Generated ERN 4.3.2.")}
          disabled={pending}
        >
          Generate
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void validate()}
          disabled={pending || !latestMessageId}
        >
          Validate XSD
        </Button>
        {latestMessageId ? (
          <a
            className="inline-flex h-10 items-center rounded-[var(--nexo-radius)] border border-[var(--nexo-outline-border)] px-4 text-[length:0.875rem] font-medium"
            href={`/admin/ddex/download/${encodeURIComponent(latestMessageId)}`}
          >
            Download XML
          </a>
        ) : null}
        <Button type="button" variant="outline" disabled={pending || !latestMessageId} onClick={() => void previewXml()}>
          Preview XML
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending || !latestMessageId}
          onClick={() => void run(() => packageErnAction(latestMessageId!, releaseId), "Package ready for delivery.")}
        >
          Package
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending || !latestMessageId}
          onClick={() => void run(() => queueErnAction(latestMessageId!, releaseId), "Queued.")}
        >
          Queue
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending || !latestMessageId}
          onClick={() => void run(() => deliverErnAction(latestMessageId!, releaseId), "Test delivery completed (local sink).")}
        >
          Deliver (test)
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending || !latestMessageId}
          onClick={() => void run(() => retryErnAction(latestMessageId!, releaseId), "Retry sent.")}
        >
          Retry
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => void run(() => updateErnAction(releaseId, testTarget?.id), "Update message generated.")}
        >
          Update
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => void run(() => takedownErnAction(releaseId, testTarget?.id), "Takedown message generated.")}
        >
          Takedown
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-caption text-[var(--nexo-text-muted)]">
          Ack reference
          <Input
            value={ackRef}
            onChange={(e) => setAckRef(e.target.value)}
            placeholder="Acknowledgment id"
            className="mt-1"
          />
        </label>
        <Button
          type="button"
          variant="secondary"
          disabled={pending || !latestMessageId || !ackRef.trim()}
          onClick={() =>
            void run(() => ackErnAction(latestMessageId!, ackRef, releaseId), "Acknowledgment recorded.")
          }
        >
          Ack
        </Button>
      </div>
      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title="ERN XML preview" className="max-w-4xl">
        <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-all text-caption">{preview}</pre>
      </Modal>
    </div>
  );
}
