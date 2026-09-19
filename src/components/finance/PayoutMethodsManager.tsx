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
  type SafePayoutMethodRow,
} from "@/app/(portal)/earnings/payouts/actions";

type Country = {
  iso2: string;
  iso3: string;
  name: string;
  flag: string | null;
  calling_code: string | null;
};
type Currency = {
  code: string;
  name: string;
  symbol: string;
  decimal_precision: number;
};
type CatalogMethod = {
  id: string;
  code: string;
  name: string;
  icon: string | null;
  processing_time_text: string | null;
};
type Route = {
  country_code: string;
  currency_code: string;
  method_id: string;
  beneficiary_type: string;
};
type Field = {
  id: string;
  country_code: string;
  currency_code: string;
  method_id: string;
  beneficiary_type: string;
  field_key: string;
  display_label: string;
  input_type: string;
  required: boolean;
  placeholder: string | null;
  help_text: string | null;
  minimum_length: number | null;
  maximum_length: number | null;
  validation_regex: string | null;
  numeric_only: boolean;
  display_order: number;
  encrypted: boolean;
  masked: boolean;
  options: unknown;
};
type Network = {
  country_code: string;
  code: string;
  name: string;
};

type Props = {
  methods: SafePayoutMethodRow[];
  countries: Country[];
  currencies: Currency[];
  catalogMethods: CatalogMethod[];
  routes: Route[];
  fields: Field[];
  mobileNetworks: Network[];
};

type BeneficiaryType = "individual" | "business";

function optionRows(value: unknown): Array<{ value: string; label: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const optionValue = typeof row.value === "string" ? row.value : "";
    const label = typeof row.label === "string" ? row.label : optionValue;
    return optionValue ? [{ value: optionValue, label }] : [];
  });
}

function methodStatus(row: SafePayoutMethodRow) {
  if (row.security_hold_until && new Date(row.security_hold_until).getTime() > Date.now()) {
    return "Security hold";
  }
  return row.status === "active" ? "Ready" : row.status.replace(/_/g, " ");
}

export function PayoutMethodsManager({
  methods,
  countries,
  currencies,
  catalogMethods,
  routes,
  fields,
  mobileNetworks,
}: Props) {
  const [rows, setRows] = React.useState(methods);
  const [step, setStep] = React.useState(1);
  const [countrySearch, setCountrySearch] = React.useState("");
  const [countryCode, setCountryCode] = React.useState("");
  const [beneficiaryType, setBeneficiaryType] =
    React.useState<BeneficiaryType>("individual");
  const [currency, setCurrency] = React.useState("");
  const [methodId, setMethodId] = React.useState("");
  const [fieldValues, setFieldValues] = React.useState<Record<string, string | boolean>>({});
  const [confirm, setConfirm] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  React.useEffect(() => setRows(methods), [methods]);

  const routeForCountry = routes.filter(
    (route) =>
      route.country_code === countryCode &&
      route.beneficiary_type === beneficiaryType
  );
  const availableCurrencyCodes = [...new Set(routeForCountry.map((route) => route.currency_code))];
  const availableCurrencies = currencies.filter((item) =>
    availableCurrencyCodes.includes(item.code)
  );
  const methodIds = [
    ...new Set(
      routeForCountry
        .filter((route) => route.currency_code === currency)
        .map((route) => route.method_id)
    ),
  ];
  const availableMethods = catalogMethods.filter((item) => methodIds.includes(item.id));
  const selectedFields = fields
    .filter(
      (field) =>
        field.country_code === countryCode &&
        field.currency_code === currency &&
        field.method_id === methodId &&
        field.beneficiary_type === beneficiaryType
    )
    .sort((a, b) => a.display_order - b.display_order);

  const selectedCountry = countries.find((item) => item.iso2 === countryCode);
  const selectedCurrency = currencies.find((item) => item.code === currency);
  const selectedMethod = catalogMethods.find((item) => item.id === methodId);
  const filteredCountries = countries.filter((country) => {
    const query = countrySearch.trim().toLowerCase();
    if (!query) return true;
    return (
      country.name.toLowerCase().includes(query) ||
      country.iso2.toLowerCase().includes(query) ||
      country.iso3.toLowerCase().includes(query)
    );
  });

  function resetWizard() {
    setStep(1);
    setCountrySearch("");
    setCountryCode("");
    setBeneficiaryType("individual");
    setCurrency("");
    setMethodId("");
    setFieldValues({});
    setConfirm(false);
    setEditingId(undefined);
  }

  function startEdit(row: SafePayoutMethodRow) {
    setEditingId(row.id);
    setCountryCode(row.country_code ?? "");
    setBeneficiaryType(
      row.beneficiary_type === "business" ? "business" : "individual"
    );
    setCurrency(row.currency ?? "");
    setMethodId(row.route_method_id ?? "");
    setFieldValues({});
    setConfirm(false);
    setStep(5);
    setMessage({
      ok: true,
      text: "For security, re-enter the required payout details before saving changes.",
    });
  }

  async function saveMethod() {
    if (!selectedCountry || !selectedCurrency || !selectedMethod || !confirm) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await savePayoutMethodAction({
        payoutMethodId: editingId,
        countryCode,
        beneficiaryType,
        currency,
        methodCatalogId: methodId,
        fieldValues,
      });
      if (!result.ok) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      setRows((current) => {
        const exists = current.some((row) => row.id === result.data.id);
        return exists
          ? current.map((row) => (row.id === result.data.id ? result.data : row))
          : [result.data, ...current];
      });
      setMessage({ ok: true, text: editingId ? "Payout method updated securely." : "Payout method saved securely." });
      resetWizard();
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
    } else {
      setMessage({ ok: true, text: "Payout method removed." });
    }
  }

  function fieldControl(field: Field) {
    const value = fieldValues[field.field_key];
    const setValue = (next: string | boolean) =>
      setFieldValues((current) => ({ ...current, [field.field_key]: next }));

    if (field.input_type === "checkbox") {
      return (
        <label key={field.id} className="flex gap-3 rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3 text-small">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(event) => setValue(event.target.checked)}
            className="mt-0.5 size-4"
          />
          <span>{field.display_label}{field.required ? " *" : ""}</span>
        </label>
      );
    }

    const configuredOptions =
      field.input_type === "mobile_network_selector"
        ? mobileNetworks
            .filter((network) => network.country_code === countryCode)
            .map((network) => ({ value: network.code, label: network.name }))
        : optionRows(field.options);

    if (
      ["select", "radio", "country", "currency", "mobile_network_selector"].includes(
        field.input_type
      )
    ) {
      const options =
        field.input_type === "country"
          ? countries.map((country) => ({
              value: country.iso2,
              label: `${country.flag ?? ""} ${country.name}`.trim(),
            }))
          : field.input_type === "currency"
            ? currencies.map((item) => ({
                value: item.code,
                label: `${item.code} — ${item.name}`,
              }))
            : configuredOptions;
      return (
        <label key={field.id} className="block space-y-1">
          <span className="text-caption font-medium">
            {field.display_label}{field.required ? " *" : ""}
          </span>
          <Select
            value={typeof value === "string" ? value : ""}
            required={field.required}
            onChange={(event) => setValue(event.target.value)}
          >
            <option value="">Select {field.display_label.toLowerCase()}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
          {field.help_text ? <span className="block text-caption text-[var(--nexo-text-muted)]">{field.help_text}</span> : null}
        </label>
      );
    }

    return (
      <label key={field.id} className="block space-y-1">
        <span className="text-caption font-medium">
          {field.display_label}{field.required ? " *" : ""}
        </span>
        <Input
          type={
            field.input_type === "email"
              ? "email"
              : field.input_type === "number"
                ? "text"
                : field.input_type === "phone"
                  ? "tel"
                  : "text"
          }
          inputMode={field.numeric_only ? "numeric" : undefined}
          autoComplete="off"
          value={typeof value === "string" ? value : ""}
          required={field.required}
          minLength={field.minimum_length ?? undefined}
          maxLength={field.maximum_length ?? undefined}
          placeholder={field.placeholder ?? undefined}
          onChange={(event) => setValue(event.target.value)}
        />
        {field.help_text ? <span className="block text-caption text-[var(--nexo-text-muted)]">{field.help_text}</span> : null}
      </label>
    );
  }

  const visibleRows = rows.filter((row) => row.status !== "disabled");

  return (
    <section className="space-y-5 rounded-[1.25rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-4 sm:p-5">
      <div>
        <h2 className="text-h4">Payout methods</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          Save multiple royalty destinations. Sensitive account details are encrypted and never shown again in full.
        </p>
      </div>

      {visibleRows.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibleRows.map((row) => (
            <article key={row.id} className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{row.display_name}</p>
                  <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                    {row.institution_name ? `${row.institution_name} · ` : ""}{row.destination_mask}
                  </p>
                  <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                    {row.country_code ?? "—"} · {row.currency ?? "—"} · {methodStatus(row)}
                    {row.is_preferred ? " · Default" : ""}
                  </p>
                </div>
                {row.is_preferred ? (
                  <span className="rounded-full border border-[var(--nexo-border)] px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide">Primary</span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {!row.is_preferred && row.status === "active" ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => void prefer(row.id)}>
                    Set as default
                  </Button>
                ) : null}
                <Button type="button" size="sm" variant="secondary" onClick={() => startEdit(row)}>
                  Edit
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => void disable(row.id)}>
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-small text-[var(--nexo-text-muted)]">No payout method added yet.</p>
      )}

      <div className="border-t border-[var(--nexo-border)] pt-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-small font-semibold">Add payout method</p>
            <p className="text-caption text-[var(--nexo-text-muted)]">Step {step} of 6</p>
          </div>
          {step > 1 ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => setStep((current) => Math.max(1, current - 1))}>
              Back
            </Button>
          ) : null}
        </div>

        {step === 1 ? (
          <div className="space-y-3">
            <h3 className="font-medium">Where would you like to receive your royalties?</h3>
            <Input
              placeholder="Search country"
              value={countrySearch}
              onChange={(event) => setCountrySearch(event.target.value)}
            />
            <div className="grid max-h-72 gap-2 overflow-auto sm:grid-cols-2">
              {filteredCountries.map((country) => (
                <button
                  type="button"
                  key={country.iso2}
                  className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3 text-left text-small hover:bg-[var(--nexo-elevated)]"
                  onClick={() => {
                    setCountryCode(country.iso2);
                    setCurrency("");
                    setMethodId("");
                    setStep(2);
                  }}
                >
                  <span className="mr-2 text-lg">{country.flag ?? "🌐"}</span>
                  <span className="font-medium">{country.name}</span>
                  <span className="ml-2 text-caption text-[var(--nexo-text-muted)]">{country.iso2}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <h3 className="font-medium">Select beneficiary type</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["individual", "Individual", "For an individual Artist or personal account."],
                ["business", "Company / Label", "For a registered label, company or business."],
              ] as const).map(([value, label, description]) => (
                <button
                  type="button"
                  key={value}
                  className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 text-left hover:bg-[var(--nexo-elevated)]"
                  onClick={() => {
                    setBeneficiaryType(value);
                    setCurrency("");
                    setMethodId("");
                    setStep(3);
                  }}
                >
                  <p className="font-medium">{label}</p>
                  <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">{description}</p>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <h3 className="font-medium">Select payout currency</h3>
            {availableCurrencies.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {availableCurrencies.map((item) => (
                  <button
                    type="button"
                    key={item.code}
                    className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3 text-left hover:bg-[var(--nexo-elevated)]"
                    onClick={() => {
                      setCurrency(item.code);
                      setMethodId("");
                      setStep(4);
                    }}
                  >
                    <span className="font-medium">{item.code}</span>
                    <span className="ml-2 text-caption text-[var(--nexo-text-muted)]">{item.name} · {item.symbol}</span>
                  </button>
                ))}
              </div>
            ) : <Alert variant="warning">No payout currency is currently enabled for this country and beneficiary type.</Alert>}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3">
            <h3 className="font-medium">Select payout method</h3>
            {availableMethods.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {availableMethods.map((method) => (
                  <button
                    type="button"
                    key={method.id}
                    className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 text-left hover:bg-[var(--nexo-elevated)]"
                    onClick={() => {
                      setMethodId(method.id);
                      setFieldValues({});
                      setStep(5);
                    }}
                  >
                    <p className="font-medium">{method.name}</p>
                    {method.processing_time_text ? <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">{method.processing_time_text}</p> : null}
                  </button>
                ))}
              </div>
            ) : <Alert variant="warning">No payout method is currently available for this route.</Alert>}
          </div>
        ) : null}

        {step === 5 ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setStep(6);
            }}
          >
            <div>
              <h3 className="font-medium">Enter payout details</h3>
              <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
                Only fields configured for {selectedCountry?.name ?? countryCode} · {currency} · {selectedMethod?.name ?? "this method"} are shown.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {selectedFields.map(fieldControl)}
            </div>
            <Button type="submit" disabled={!selectedFields.length}>Review details</Button>
          </form>
        ) : null}

        {step === 6 ? (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">Review and confirm</h3>
              <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">Full banking credentials will be encrypted when you save.</p>
            </div>
            <dl className="grid gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 text-small sm:grid-cols-2">
              <div><dt className="text-caption text-[var(--nexo-text-muted)]">Country</dt><dd>{selectedCountry?.flag} {selectedCountry?.name}</dd></div>
              <div><dt className="text-caption text-[var(--nexo-text-muted)]">Beneficiary</dt><dd>{beneficiaryType === "business" ? "Company / Label" : "Individual"}</dd></div>
              <div><dt className="text-caption text-[var(--nexo-text-muted)]">Currency</dt><dd>{currency} — {selectedCurrency?.name}</dd></div>
              <div><dt className="text-caption text-[var(--nexo-text-muted)]">Method</dt><dd>{selectedMethod?.name}</dd></div>
            </dl>
            <label className="flex gap-3 rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-3 text-small">
              <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} className="mt-0.5 size-4" />
              <span>I confirm that these payout details are correct and belong to me or my registered business.</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={busy || !confirm} onClick={() => void saveMethod()}>
                {busy ? "Saving securely…" : editingId ? "Save changes" : "Save payout method"}
              </Button>
              <Button type="button" variant="ghost" onClick={resetWizard}>Cancel</Button>
            </div>
          </div>
        ) : null}
      </div>

      {message ? <Alert variant={message.ok ? "success" : "error"}>{message.text}</Alert> : null}
    </section>
  );
}
