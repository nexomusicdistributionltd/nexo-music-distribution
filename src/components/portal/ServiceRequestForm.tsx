"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { createServiceRequestAction } from "@/app/(portal)/portal-actions";

export function ServiceRequestForm({
  kind,
  titlePlaceholder,
  urlLabel,
  releases,
  requiresRelease = false,
  guidance,
}: {
  kind: string;
  titlePlaceholder: string;
  urlLabel?: string;
  releases: { id: string; title: string | null }[];
  requiresRelease?: boolean;
  guidance?: string;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);

  return (
    <form
      className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pending) return;
        setPending(true);
        setError(null);
        setOk(false);
        const fd = new FormData(e.currentTarget);
        const res = await createServiceRequestAction({
          kind,
          title: String(fd.get("title") || ""),
          body: String(fd.get("body") || ""),
          related_url: String(fd.get("related_url") || ""),
          release_id: String(fd.get("release_id") || "") || undefined,
        });
        setPending(false);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        (e.target as HTMLFormElement).reset();
        setOk(true);
      }}
    >
      <h2 className="text-h4">New request</h2>
      {guidance ? (
        <p className="text-small text-[var(--nexo-text-muted)]">{guidance}</p>
      ) : null}
      {requiresRelease && releases.length === 0 ? (
        <Alert variant="warning" title="Release required">
          Create and submit an eligible release before using this service.
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="warning" title="Not saved">
          {error}
        </Alert>
      ) : null}
      {ok ? (
        <Alert variant="success" title="Submitted">
          Your request is live in Nexo operations. Status changes will appear here as staff or the connected provider progresses the real workflow.
        </Alert>
      ) : null}
      <Input name="title" required placeholder={titlePlaceholder} aria-label="Title" />
      {urlLabel ? (
        <Input name="related_url" placeholder={urlLabel} aria-label={urlLabel} />
      ) : (
        <Input name="related_url" placeholder="Related URL (optional)" aria-label="Related URL" />
      )}
      {releases.length > 0 ? (
        <Select name="release_id" aria-label="Release" required={requiresRelease}>
          <option value="">{requiresRelease ? "Select release" : "No specific release"}</option>
          {releases.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title || "Untitled"}
            </option>
          ))}
        </Select>
      ) : null}
      <Textarea name="body" placeholder="Details" aria-label="Details" />
      <Button type="submit" disabled={pending || (requiresRelease && releases.length === 0)}>
        {pending ? "Submitting…" : "Submit request"}
      </Button>
    </form>
  );
}
