"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { createComplianceCaseAction } from "@/app/admin/actions";

export function CreateComplianceForm() {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  return (
    <form
      className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const r = await createComplianceCaseAction({ title, summary });
        setPending(false);
        if (!r.ok) setError(r.error);
        else router.refresh();
      }}
    >
      <h2 className="text-h4">New case</h2>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required />
      <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Summary" rows={3} />
      {error ? <p className="text-caption text-red-500">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        Create case
      </Button>
    </form>
  );
}
