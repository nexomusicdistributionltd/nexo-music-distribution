"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { reviseServiceRequestAction } from "@/app/(portal)/portal-actions";

export function ServiceRequestRevisionForm({
  requestId,
  defaultBody,
  defaultUrl,
}: {
  requestId: string;
  defaultBody?: string | null;
  defaultUrl?: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);

  return (
    <form
      className="mt-4 space-y-3 rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        setPending(true);
        setError(null);
        setOk(false);
        const formData = new FormData(event.currentTarget);
        const result = await reviseServiceRequestAction({
          request_id: requestId,
          body: String(formData.get("body") || ""),
          related_url: String(formData.get("related_url") || ""),
        });
        setPending(false);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setOk(true);
        router.refresh();
      }}
    >
      <p className="text-small font-medium">Provide the requested information</p>
      {error ? <Alert variant="warning" title="Not resubmitted">{error}</Alert> : null}
      {ok ? <Alert variant="success" title="Resubmitted">Nexo operations can review the updated request now.</Alert> : null}
      <Textarea
        name="body"
        defaultValue={defaultBody || ""}
        placeholder="Add the information or correction requested by Nexo operations"
        required
        maxLength={8000}
      />
      <Input
        name="related_url"
        defaultValue={defaultUrl || ""}
        placeholder="Supporting URL (optional)"
        maxLength={2000}
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Resubmitting…" : "Resubmit for review"}
      </Button>
    </form>
  );
}
