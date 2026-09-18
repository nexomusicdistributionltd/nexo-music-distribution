"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { upsertRoyaltyImportBatchAction } from "@/app/admin/finance/actions";

export function CreateImportBatchForm() {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setPending(true);
        setError(null);
        const r = await upsertRoyaltyImportBatchAction({
          sourceProvider: String(fd.get("sourceProvider") || "").trim(),
          reportId: String(fd.get("reportId") || "").trim(),
          periodStart: String(fd.get("periodStart") || "") || undefined,
          periodEnd: String(fd.get("periodEnd") || "") || undefined,
          currency: String(fd.get("currency") || "") || undefined,
        });
        setPending(false);
        if (!r.ok) setError(r.error);
        else router.refresh();
      }}
    >
      <Input name="sourceProvider" placeholder="source_provider" required />
      <Input name="reportId" placeholder="report_id" required />
      <Input name="periodStart" type="date" />
      <Input name="periodEnd" type="date" />
      <Input name="currency" placeholder="USD" maxLength={3} />
      <Button type="submit" size="sm" disabled={pending}>
        Upsert batch
      </Button>
      {error ? <span className="text-caption text-red-500">{error}</span> : null}
    </form>
  );
}
