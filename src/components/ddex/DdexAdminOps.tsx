"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { deliverErnAction, generateErnAction, validateErnAction } from "@/app/admin/ddex/actions";

export function DdexAdminOps({
  releaseId,
  latestMessageId,
}: {
  releaseId: string;
  latestMessageId?: string | null;
}) {
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function generate() {
    setPending(true);
    setError(null);
    setInfo(null);
    const res = await generateErnAction(releaseId);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const data = res.data as { filename?: string; xmlSha256?: string };
    setInfo(`Generated ${data.filename ?? "ERN"} (sha256 ${data.xmlSha256?.slice(0, 12) ?? "—"}…).`);
    window.location.reload();
  }

  async function validate() {
    if (!latestMessageId) return;
    setPending(true);
    setError(null);
    setInfo(null);
    const res = await validateErnAction(latestMessageId, releaseId);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setInfo("Official XSD validation passed.");
    window.location.reload();
  }

  async function deliver() {
    if (!latestMessageId) return;
    setPending(true);
    setError(null);
    const res = await deliverErnAction(latestMessageId);
    setPending(false);
    if (!res.ok) setError(res.error);
  }

  return (
    <div className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-5">
      <h2 className="text-h4">ERN 4.3.2 operations</h2>
      <p className="text-small text-[var(--nexo-text-muted)]">
        Generate, XSD-validate, and download NewReleaseMessage XML. Delivery requires a real
        transport — none is connected. No XML is built in the browser.
      </p>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {info ? <Alert variant="success">{info}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void generate()} disabled={pending}>
          Generate ERN 4.3.2
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
        <Button
          type="button"
          variant="outline"
          onClick={() => void deliver()}
          disabled={pending || !latestMessageId}
        >
          Deliver
        </Button>
      </div>
    </div>
  );
}
