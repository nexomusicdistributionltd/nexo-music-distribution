"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import {
  deletePayoutMethodAction,
  savePayoutMethodAction,
  setPreferredPayoutMethodAction,
} from "@/app/(portal)/earnings/payout-methods/actions";

type Method = {
  id: string;
  method_type: string;
  display_name: string;
  country_code: string | null;
  currency: string | null;
  beneficiary_name: string;
  details: Record<string, string>;
  provider: string;
  is_preferred: boolean;
  status: string;
};

function masked(value: string | undefined): string {
  if (!value) return "";
  if (value.includes("@")) {
    const [left, right] = value.split("@");
    return `${left.slice(0, 2)}***@${right}`;
  }
  const compact = value.replace(/\s+/g, "");
  return compact.length <= 4 ? "••••" : `•••• ${compact.slice(-4)}`;
}

export function PayoutMethodsClient({ methods }: { methods: Method[] }) {
  const [busy, start] = React.useTransition();
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [type, setType] = React.useState("bank_transfer");

  function submit(form: HTMLFormElement) {
    const fd = new FormData(form);
    const details: Record<string, string> = {};
    for (const key of [
      "bank_name",
      "account_number",
      "routing_code",
      "swift_bic",
      "iban",
      "email",
      "phone",
      "provider_name",
      "destination",
      "notes",
    ]) {
      const value = String(fd.get(key) || "").trim();
      if (value) details[key] = value;
    }

    start(async () => {
      setError(null);
      setMessage(null);
      const res = await savePayoutMethodAction({
        methodType: String(fd.get("method_type") || ""),
        displayName: String(fd.get("display_name") || ""),
        countryCode: String(fd.get("country_code") || ""),
        currency: String(fd.get("currency") || ""),
        beneficiaryName: String(fd.get("beneficiary_name") || ""),
        details,
        preferred: fd.get("preferred") === "on",
      });
      if (!res.ok) setError(res.error);
      else {
        setMessage("Payout method saved.");
        form.reset();
      }
    });
  }

  return (
    <section className="space-y-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
      <div>
        <h2 className="text-h3">Payment methods</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          Nexo can process payouts manually from the verified method you select. A future
          payout-provider adapter can attach to the same records without changing your saved preference.
        </p>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <form
        className="grid gap-3 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(e.currentTarget);
        }}
      >
        <Select
          name="method_type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="bank_transfer">Bank transfer</option>
          <option value="paypal">PayPal</option>
          <option value="payoneer">Payoneer</option>
          <option value="mobile_money">Mobile money</option>
          <option value="other">Other</option>
        </Select>
        <Input name="display_name" required placeholder="Method name e.g. Main USD account" />
        <Input name="beneficiary_name" required placeholder="Beneficiary legal name" />
        <Input name="country_code" maxLength={2} placeholder="Country e.g. NG" />
        <Input name="currency" maxLength={3} placeholder="Currency e.g. USD" />
        {type === "bank_transfer" ? (
          <>
            <Input name="bank_name" required placeholder="Bank name" />
            <Input name="account_number" required placeholder="Account / IBAN number" />
            <Input name="routing_code" placeholder="Routing / sort code" />
            <Input name="swift_bic" placeholder="SWIFT / BIC" />
          </>
        ) : type === "paypal" || type === "payoneer" ? (
          <Input name="email" type="email" required placeholder="Account email" />
        ) : type === "mobile_money" ? (
          <>
            <Input name="provider_name" required placeholder="Mobile money provider" />
            <Input name="phone" required placeholder="Phone number" />
          </>
        ) : (
          <Input name="destination" required placeholder="Payment destination" />
        )}
        <Input name="notes" placeholder="Optional processing notes" />
        <label className="flex items-center gap-2 text-small">
          <input type="checkbox" name="preferred" />
          Make preferred payout method
        </label>
        <div className="md:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Add payment method"}
          </Button>
        </div>
      </form>

      {methods.length > 0 ? (
        <ul className="space-y-2">
          {methods.map((method) => {
            const destination =
              method.details.account_number ||
              method.details.iban ||
              method.details.email ||
              method.details.phone ||
              method.details.destination ||
              "";
            return (
              <li
                key={method.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3"
              >
                <div>
                  <p className="text-small font-medium">
                    {method.display_name}
                    {method.is_preferred ? " · Preferred" : ""}
                  </p>
                  <p className="text-caption text-[var(--nexo-text-muted)]">
                    {method.method_type.replace(/_/g, " ")} · {method.beneficiary_name}
                    {destination ? ` · ${masked(destination)}` : ""}
                    {method.currency ? ` · ${method.currency}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!method.is_preferred ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        start(async () => {
                          const res = await setPreferredPayoutMethodAction(method.id);
                          if (!res.ok) setError(res.error);
                        })
                      }
                    >
                      Make preferred
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      start(async () => {
                        const res = await deletePayoutMethodAction(method.id);
                        if (!res.ok) setError(res.error);
                      })
                    }
                  >
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-small text-[var(--nexo-text-muted)]">No payout method saved yet.</p>
      )}
    </section>
  );
}
