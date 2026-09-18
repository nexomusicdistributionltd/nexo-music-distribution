"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import {
  disablePayoutMethodAction,
  savePayoutMethodAction,
  setPreferredPayoutMethodAction,
} from "@/app/(portal)/earnings/payouts/actions";
import { PAYOUT_METHOD_TYPES, payoutMethodLabel } from "@/lib/finance/payout-methods";

export type PayoutMethodSafeRow = {
  id: string;
  method_type: string;
  display_name: string;
  country_code: string | null;
  currency: string | null;
  beneficiary_name: string;
  destination_mask: string;
  is_preferred: boolean;
  status: string;
};

export function PayoutMethodsManager({ methods }: { methods: PayoutMethodSafeRow[] }) {
  const [rows, setRows] = React.useState(methods);
  const [methodType, setMethodType] = React.useState("bank_transfer");
  const [displayName, setDisplayName] = React.useState("");
  const [beneficiaryName, setBeneficiaryName] = React.useState("");
  const [destination, setDestination] = React.useState("");
  const [institution, setInstitution] = React.useState("");
  const [countryCode, setCountryCode] = React.useState("");
  const [currency, setCurrency] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  React.useEffect(() => setRows(methods), [methods]);

  async function addMethod() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await savePayoutMethodAction({
        methodType,
        displayName,
        beneficiaryName,
        destination,
        institution,
        countryCode,
        currency,
      });
      if (!result.ok) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      setRows((current) => [...current, result.data]);
      setMessage({
        ok: true,
        text: "Payout method saved and sent to Nexo Finance for verification.",
      });
      setDisplayName("");
      setBeneficiaryName("");
      setDestination("");
      setInstitution("");
      setCountryCode("");
      setCurrency("");
    } finally {
      setBusy(false);
    }
  }

  async function prefer(id: string) {
    const previous = rows;
    setRows((current) =>
      current.map((row) => ({ ...row, is_preferred: row.id === id }))
    );
    const result = await setPreferredPayoutMethodAction(id);
    if (!result.ok) {
      setRows(previous);
      setMessage({ ok: false, text: result.error });
    }
  }

  async function disable(id: string) {
    const previous = rows;
    setRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, status: "disabled", is_preferred: false } : row
      )
    );
    const result = await disablePayoutMethodAction(id);
    if (!result.ok) {
      setRows(previous);
      setMessage({ ok: false, text: result.error });
    }
  }

  const visible = rows.filter((row) => row.status !== "disabled");

  return (
    <section className="space-y-5 rounded-[1.25rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
      <div>
        <h2 className="text-h4">Payout methods</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          Add a bank, wallet or payment destination. New methods require Nexo Finance approval
          before they can be used for a royalty payout.
        </p>
      </div>

      {visible.length > 0 ? (
        <ul className="space-y-2">
          {visible.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3 text-small"
            >
              <div>
                <p className="font-medium">{row.display_name}</p>
                <p className="text-caption text-[var(--nexo-text-muted)]">
                  {payoutMethodLabel(row.method_type)} · {row.destination_mask}
                  {row.currency ? ` · ${row.currency}` : ""}
                  {row.is_preferred ? " · Preferred" : ""}
                </p>
                <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                  {row.status === "active"
                    ? "Approved"
                    : row.status === "verification_required"
                      ? "Finance review required"
                      : row.status.replace(/_/g, " ")}
                </p>
              </div>
              <div className="flex gap-2">
                {row.status === "active" && !row.is_preferred ? (
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
      ) : (
        <p className="text-small text-[var(--nexo-text-muted)]">No payout method added yet.</p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={methodType} onChange={(e) => setMethodType(e.target.value)}>
          {PAYOUT_METHOD_TYPES.map((type) => (
            <option key={type} value={type}>
              {payoutMethodLabel(type)}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Method name, e.g. Main USD bank"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <Input
          placeholder="Beneficiary / account holder name"
          value={beneficiaryName}
          onChange={(e) => setBeneficiaryName(e.target.value)}
        />
        <Input
          placeholder="Account number, email or wallet destination"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        />
        <Input
          placeholder="Bank / payment provider (optional)"
          value={institution}
          onChange={(e) => setInstitution(e.target.value)}
        />
        <Input
          placeholder="Country code, e.g. NG or US"
          maxLength={2}
          value={countryCode}
          onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
        />
        <Input
          placeholder="Currency, e.g. USD"
          maxLength={3}
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
        />
      </div>
      <Button
        type="button"
        disabled={
          busy ||
          !displayName.trim() ||
          !beneficiaryName.trim() ||
          !destination.trim()
        }
        onClick={() => void addMethod()}
      >
        {busy ? "Saving…" : "Add payout method"}
      </Button>
      {message ? (
        <Alert variant={message.ok ? "success" : "error"}>{message.text}</Alert>
      ) : null}
    </section>
  );
}
