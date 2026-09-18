"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { requestReportExportAction } from "@/app/admin/actions";

export function ReportRequestForm() {
  const router = useRouter();
  const [reportType, setReportType] = React.useState("releases_summary");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setMsg(null);
        const r = await requestReportExportAction({ reportType });
        setPending(false);
        if (!r.ok) setMsg(r.error);
        else {
          setMsg(`Queued export ${r.data.id} (pending — no fake file generated).`);
          router.refresh();
        }
      }}
    >
      <label className="space-y-1 text-small">
        <span className="text-label">Report</span>
        <Select value={reportType} onChange={(e) => setReportType(e.target.value)}>
          <option value="releases_summary">Releases summary</option>
          <option value="qc_throughput">QC throughput</option>
          <option value="users_summary">Users summary</option>
          <option value="tickets_summary">Tickets summary</option>
        </Select>
      </label>
      <Button type="submit" disabled={pending}>
        Request export
      </Button>
      {msg ? <p className="w-full text-caption">{msg}</p> : null}
    </form>
  );
}
