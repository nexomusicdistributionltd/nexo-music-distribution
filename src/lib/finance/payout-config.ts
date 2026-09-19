export type ConfiguredPayoutField = {
  id: string;
  field_key: string;
  display_label: string;
  input_type:
    | "text"
    | "number"
    | "select"
    | "phone"
    | "email"
    | "textarea"
    | "checkbox"
    | "radio"
    | "country"
    | "currency"
    | "bank_selector"
    | "mobile_network_selector";
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
  enabled: boolean;
  options: Array<{ value: string; label: string }> | unknown;
};

export type PayoutFieldValues = Record<string, string | boolean>;

function textValue(value: string | boolean | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function isChecked(value: string | boolean | undefined): boolean {
  return value === true || value === "true" || value === "on" || value === "1";
}

function optionsFor(field: ConfiguredPayoutField): Array<{ value: string; label: string }> {
  if (!Array.isArray(field.options)) return [];
  return field.options.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const row = value as Record<string, unknown>;
    const optionValue = typeof row.value === "string" ? row.value : "";
    const label = typeof row.label === "string" ? row.label : optionValue;
    return optionValue ? [{ value: optionValue, label }] : [];
  });
}

export function validateConfiguredPayoutValues(
  fields: ConfiguredPayoutField[],
  input: PayoutFieldValues
):
  | { ok: true; values: Record<string, string | boolean> }
  | { ok: false; error: string } {
  const values: Record<string, string | boolean> = {};

  for (const field of fields.filter((row) => row.enabled).sort((a, b) => a.display_order - b.display_order)) {
    const raw = input[field.field_key];

    if (field.input_type === "checkbox") {
      const checked = isChecked(raw);
      if (field.required && !checked) {
        return { ok: false, error: `${field.display_label} must be confirmed.` };
      }
      values[field.field_key] = checked;
      continue;
    }

    const value = textValue(raw);
    if (field.required && !value) {
      return { ok: false, error: `${field.display_label} is required.` };
    }
    if (!value) {
      values[field.field_key] = "";
      continue;
    }
    if (field.minimum_length !== null && value.length < field.minimum_length) {
      return { ok: false, error: `${field.display_label} is too short.` };
    }
    if (field.maximum_length !== null && value.length > field.maximum_length) {
      return { ok: false, error: `${field.display_label} is too long.` };
    }
    if (field.numeric_only && !/^\d+$/.test(value.replace(/[- ]/g, ""))) {
      return { ok: false, error: `${field.display_label} must contain numbers only.` };
    }
    if (field.input_type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return { ok: false, error: `${field.display_label} must be a valid email address.` };
    }
    if (field.validation_regex) {
      try {
        if (!new RegExp(field.validation_regex).test(value)) {
          return { ok: false, error: `${field.display_label} is not valid.` };
        }
      } catch {
        return { ok: false, error: `${field.display_label} cannot be validated right now.` };
      }
    }
    const options = optionsFor(field);
    if ((field.input_type === "select" || field.input_type === "radio") && options.length) {
      if (!options.some((option) => option.value === value)) {
        return { ok: false, error: `${field.display_label} has an invalid selection.` };
      }
    }
    values[field.field_key] = value;
  }
  return { ok: true, values };
}

const BENEFICIARY_KEYS = [
  "beneficiary_name",
  "account_holder_name",
  "business_name",
  "legal_business_name",
] as const;

export function payoutBeneficiaryName(values: Record<string, string | boolean>): string {
  for (const key of BENEFICIARY_KEYS) {
    const value = values[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const first = typeof values.first_name === "string" ? values.first_name.trim() : "";
  const middle = typeof values.middle_name === "string" ? values.middle_name.trim() : "";
  const last = typeof values.last_name === "string" ? values.last_name.trim() : "";
  const combined = [first, middle, last].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  const representative =
    typeof values.authorized_representative === "string"
      ? values.authorized_representative.trim()
      : "";
  return representative;
}

export function payoutInstitutionName(values: Record<string, string | boolean>): string | null {
  for (const key of ["bank_name", "mobile_money_network"] as const) {
    const value = values[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function visibleTail(value: string, count = 4): string {
  const compact = value.replace(/[\s-]+/g, "");
  return compact.slice(-Math.min(count, compact.length));
}

export function maskConfiguredPayoutDestination(
  fields: ConfiguredPayoutField[],
  values: Record<string, string | boolean>
): string {
  const priority = [
    "account_number",
    "iban",
    "greytag",
    "mobile_money_number",
    "routing_number",
    "sort_code",
    "ifsc",
    "swift_bic",
  ];
  for (const key of priority) {
    const field = fields.find((candidate) => candidate.field_key === key);
    const raw = values[key];
    if (!field || typeof raw !== "string" || !raw.trim()) continue;
    const value = raw.trim();
    if (!field.masked) return value;
    if (key === "iban") {
      const compact = value.replace(/\s+/g, "").toUpperCase();
      return compact.length > 6
        ? `${compact.slice(0, 2)}••••••••${visibleTail(compact)}`
        : "••••";
    }
    if (key === "greytag") {
      const tag = value.startsWith("@") ? value.slice(1) : value;
      return `@••••${visibleTail(tag)}`;
    }
    return `••••${visibleTail(value)}`;
  }
  return "Secure destination";
}

export function safePayoutPublicDetails(
  values: Record<string, string | boolean>
): Record<string, string> {
  const publicKeys = ["bank_name", "mobile_money_network", "payment_scheme"];
  const out: Record<string, string> = {};
  for (const key of publicKeys) {
    const value = values[key];
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return out;
}
