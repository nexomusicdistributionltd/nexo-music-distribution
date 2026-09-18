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
import { payoutMethodLabel } from "@/lib/finance/payout-methods";

export type PayoutMethodSafeRow = {
  id: string;
  option_id?: string | null;
  method_type: string;
  display_name: string;
  country_code: string | null;
  currency: string | null;
  beneficiary_name: string;
  destination_mask: string;
  is_preferred: boolean;
  status: string;
};

export type PayoutMethodOptionSafeRow = {
  id: string;
  code: string;
  display_name: string;
  method_type: string;
  destination_label: string;
  instructions: string | null;
  requires_institution: boolean;
  requires_country: boolean;
  requires_currency: boolean;
  requires_review: boolean;
  allowed_countries: string[] | null;
  allowed_currencies: string[] | null;
};

export function PayoutMethodsManager({
  methods,
  options,
}: {
  methods: PayoutMethodSafeRow[];
  options: PayoutMethodOptionSafeRow[];
}) {
  const [rows, setRows] = React.useState(methods);
  const [optionId, setOptionId] = React.useState(options[0]?.id ?? "");
  const [displayName, setDisplayName] = React.useState("");
  const [beneficiaryName, setBeneficiaryName] = React.useState("");
  const [destination, setDestination] = React.useState("");
  const [institution, setInstitution] = React.useState("");
  const [countryCode, setCountryCode] = React.useState("");
  const [currency, setCurrency] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  React.useEffect(() => setRows(methods), [methods]);
  React.useEffect(() => {
    if (!optionId && options[0]?.id) setOptionId(options[0].id);
  }, [optionId, options]);

  const selected = options.find((option) => option.id === optionId) ?? options[0] ?? null;

  async function addMethod() {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await savePayoutMethodAction({
        optionId: selected.id,
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
        text:
          result.data.status === "active"
            ? "Payout method added and ready to use."
            : "Payout method saved and sent to Nexo Finance for review.",
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
    setRows((current) => current.map((row) => ({ ...row, is_preferred: row.id === id })));
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
    <section id="payment-methods" className="scroll-mt-20 space-y-5 rounded-[1.25rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
      <div>
        <h2 className="text-h4">Payment method</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          Choose from the payout methods enabled by Nexo Finance, then enter your own receiving details.
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
                    ? "Ready for payouts"
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
      ) : null}

      {options.length === 0 ? (
        <Alert title="No payout methods available">
          Nexo Finance has not enabled a payout method for account setup yet.
        </Alert>
      ) : (
        <div className="space-y-3 rounded-[var(--nexo-radius-lg)] bg-[var(--nexo-elevated)] p-4">
          <Select value={selected?.id ?? ""} onChange={(event) => setOptionId(event.target.value)}>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.display_name}
              </option>
            ))}
          </Select>

          {selected?.instructions ? (
            <p className="text-caption text-[var(--nexo-text-muted)]">{selected.instructions}</p>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder={selected ? `${selected.display_name} nickname (optional)` : "Method nickname"}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <Input
              placeholder="Beneficiary / account holder name"
              value={beneficiaryName}
              onChange={(event) => setBeneficiaryName(event.target.value)}
            />
            <Input
              placeholder={selected?.destination_label ?? "Account / destination"}
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
            />
            {selected?.requires_institution ? (
              <Input
                placeholder="Bank / payment provider"
                value={institution}
                onChange={(event) => setInstitution(event.target.value)}
              />
            ) : null}
            {selected?.requires_country || (selected?.allowed_countries?.length ?? 0) > 0 ? (
              <Input
                placeholder="Country code, e.g. NG or US"
                maxLength={2}
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value.toUpperCase())}
              />
            ) : null}
            {selected?.requires_currency || (selected?.allowed_currencies?.length ?? 0) > 0 ? (
              <Input
                placeholder="Currency, e.g. USD"
                maxLength={3}
                value={currency}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              />
            ) : null}
          </div>

          <Button
            type="button"
            disabled={busy || !selected || !beneficiaryName.trim() || !destination.trim()}
            onClick={() => void addMethod()}
          >
            {busy ? "Saving…" : "Add payment method"}
          </Button>
        </div>
      )}

      {message ? <Alert variant={message.ok ? "success" : "error"}>{message.text}</Alert> : null}
    </section>
  );
}
