"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { saveAdminPayoutMethodAction } from "@/app/admin/finance/actions";
import { PAYOUT_METHOD_TYPES, payoutMethodLabel } from "@/lib/finance/payout-methods";

export function AdminPayoutMethodForm() {
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [methodType, setMethodType] = React.useState("bank_transfer");

  return (
    <form
      className="grid gap-2 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4 md:grid-cols-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setBusy(true);
        setMessage(null);
        const result = await saveAdminPayoutMethodAction({
          ownerUserId: String(fd.get("ownerUserId") || ""),
          methodType,
          label: String(fd.get("label") || ""),
          destination: String(fd.get("destination") || ""),
          accountHolder: String(fd.get("accountHolder") || ""),
          bankName: String(fd.get("bankName") || ""),
          country: String(fd.get("country") || ""),
          preferred: fd.get("preferred") === "on",
        });
        setBusy(false);
        setMessage(result.ok ? "Payment method saved for account." : result.error);
        if (result.ok) form.reset();
      }}
    >
      <div className="md:col-span-3">
        <h2 className="text-h4">Set account payout method</h2>
        <p className="text-caption text-[var(--nexo-text-muted)]">Finance can configure a verified manual payout destination even when provider automation is not active.</p>
      </div>
      <Input name="ownerUserId" placeholder="Account owner UUID" required />
      <Select value={methodType} onChange={(e) => setMethodType(e.target.value)}>
        {PAYOUT_METHOD_TYPES.map((type) => <option key={type} value={type}>{payoutMethodLabel(type)}</option>)}
      </Select>
      <Input name="label" placeholder="Method label" required />
      <Input name="destination" placeholder="Account / email / destination" required />
      <Input name="accountHolder" placeholder="Account holder" />
      <Input name="bankName" placeholder="Bank / provider" />
      <Input name="country" placeholder="Country" />
      <label className="flex items-center gap-2 text-small"><input type="checkbox" name="preferred" /> Preferred</label>
      <div><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save method"}</Button></div>
      {message ? <p className="md:col-span-3 text-caption text-[var(--nexo-text-muted)]">{message}</p> : null}
    </form>
  );
}
