"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  disablePayoutMethodAction,
  savePayoutMethodAction,
  setPreferredPayoutMethodAction,
} from "@/app/(portal)/earnings/payouts/actions";
import { payoutMethodLabel, PAYOUT_METHOD_TYPES } from "@/lib/finance/payout-methods";

type Row = {
  id: string;
  method_type: string;
  label: string;
  destination_mask: string | null;
  is_preferred: boolean;
  status: string;
};

export function PayoutMethodsManager({ methods }: { methods: Row[] }) {
  const [rows, setRows] = React.useState(methods);
  const [methodType, setMethodType] = React.useState("bank_transfer");
  const [label, setLabel] = React.useState("");
  const [destination, setDestination] = React.useState("");
  const [accountHolder, setAccountHolder] = React.useState("");
  const [bankName, setBankName] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => setRows(methods), [methods]);

  async function add() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await savePayoutMethodAction({
        methodType,
        label,
        destination,
        accountHolder,
        bankName,
        country,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setRows((current) => [
        ...(result.data.is_preferred ? current.map((row) => ({ ...row, is_preferred: false })) : current),
        result.data,
      ]);
      setMessage("Payout method saved.");
      setLabel("");
      setDestination("");
      setAccountHolder("");
      setBankName("");
      setCountry("");
    } finally {
      setBusy(false);
    }
  }

  async function prefer(id: string) {
    const previous = rows;
    setRows((current) => current.map((r) => ({ ...r, is_preferred: r.id === id })));
    const result = await setPreferredPayoutMethodAction(id);
    if (!result.ok) {
      setRows(previous);
      setMessage(result.error);
    }
  }

  async function disable(id: string) {
    const previous = rows;
    setRows((current) => current.filter((r) => r.id !== id));
    const result = await disablePayoutMethodAction(id);
    if (!result.ok) {
      setRows(previous);
      setMessage(result.error);
    }
  }

  return (
    <section className="space-y-4 rounded-[1.25rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
      <div>
        <h2 className="text-h4">Payment methods</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          Add the destination you want Nexo finance to use. Only masked destination data is shown back in the dashboard.
        </p>
      </div>

      {rows.length > 0 ? (
        <ul className="space-y-2">
          {rows.filter((row) => row.status !== "disabled").map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3 text-small">
              <div>
                <p className="font-medium">{row.label}</p>
                <p className="text-caption text-[var(--nexo-text-muted)]">
                  {payoutMethodLabel(row.method_type)} · {row.destination_mask || "secure destination"}
                  {row.is_preferred ? " · Preferred" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                {!row.is_preferred ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => void prefer(row.id)}>
                    Make preferred
                  </Button>
                ) : null}
                <Button type="button" size="sm" variant="ghost" onClick={() => void disable(row.id)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={methodType} onChange={(e) => setMethodType(e.target.value)}>
          {PAYOUT_METHOD_TYPES.filter((type) => type !== "rthyms").map((type) => (
            <option key={type} value={type}>{payoutMethodLabel(type)}</option>
          ))}
        </Select>
        <Input placeholder="Method label, e.g. Main bank account" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Input placeholder="Account / email / destination" value={destination} onChange={(e) => setDestination(e.target.value)} />
        <Input placeholder="Account holder (optional)" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
        <Input placeholder="Bank / wallet provider (optional)" value={bankName} onChange={(e) => setBankName(e.target.value)} />
        <Input placeholder="Country (optional)" value={country} onChange={(e) => setCountry(e.target.value)} />
      </div>
      <Button type="button" disabled={busy || !label.trim() || !destination.trim()} onClick={() => void add()}>
        {busy ? "Saving…" : "Add payment method"}
      </Button>
      {message ? <p className="text-caption text-[var(--nexo-text-muted)]">{message}</p> : null}
    </section>
  );
}
