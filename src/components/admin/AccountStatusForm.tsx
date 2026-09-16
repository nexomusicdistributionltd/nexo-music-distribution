"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { setAccountStatusAction } from "@/app/admin/actions";

export function AccountStatusForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [status, setStatus] = React.useState<"active" | "suspended" | "deactivated">(
    "suspended"
  );
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  return (
    <form
      className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pending) return;
        setPending(true);
        setError(null);
        setOk(false);
        const res = await setAccountStatusAction({ userId, status, reason });
        setPending(false);
        if (!res.ok) setError(res.error);
        else {
          setOk(true);
          router.refresh();
        }
      }}
    >
      <h3 className="text-h4">Suspend / restore</h3>
      <Select
        value={status}
        onChange={(e) => setStatus(e.target.value as typeof status)}
        aria-label="Account status"
      >
        <option value="suspended">Suspend</option>
        <option value="deactivated">Deactivate</option>
        <option value="active">Restore (active)</option>
      </Select>
      <Textarea
        required
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required, audited)"
        rows={3}
      />
      {error ? (
        <Alert variant="warning" title="Failed">
          {error}
        </Alert>
      ) : null}
      {ok ? <Alert title="Updated">Account status updated.</Alert> : null}
      <Button type="submit" disabled={pending}>
        Apply
      </Button>
    </form>
  );
}
