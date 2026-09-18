"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  adminSavePayoutMethodOptionAction,
  adminTogglePayoutMethodOptionAction,
} from "@/app/admin/finance/payout-methods/actions";

export type AdminPayoutOptionRow = {
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
  is_enabled: boolean;
  sort_order: number;
};

function csv(values: string[] | null): string {
  return (values ?? []).join(", ");
}

export function AdminPayoutMethodOptionsClient({ rows }: { rows: AdminPayoutOptionRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<string | null>(null);

  const save = (form: HTMLFormElement, id?: string) => {
    const fd = new FormData(form);
    startTransition(async () => {
      const result = await adminSavePayoutMethodOptionAction({
        id,
        code: String(fd.get("code") || ""),
        displayName: String(fd.get("display_name") || ""),
        methodType: String(fd.get("method_type") || "bank_transfer"),
        destinationLabel: String(fd.get("destination_label") || ""),
        instructions: String(fd.get("instructions") || ""),
        requiresInstitution: fd.get("requires_institution") === "on",
        requiresCountry: fd.get("requires_country") === "on",
        requiresCurrency: fd.get("requires_currency") === "on",
        requiresReview: fd.get("requires_review") === "on",
        allowedCountries: String(fd.get("allowed_countries") || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        allowedCurrencies: String(fd.get("allowed_currencies") || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        enabled: fd.get("enabled") === "on",
        sortOrder: Number(fd.get("sort_order") || 100),
      });
      setMessage(result.ok ? "Payout option saved." : result.error);
      if (result.ok) {
        if (!id) form.reset();
        router.refresh();
      }
    });
  };

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-h4">Available payout methods</h2>
        <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
          Only enabled methods appear to Artists and Labels. They enter their own receiving details.
        </p>
      </div>

      <form
        className="grid gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 md:grid-cols-2 xl:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          save(event.currentTarget);
        }}
      >
        <Input name="code" required placeholder="code, e.g. wise" />
        <Input name="display_name" required placeholder="Display name" />
        <Select name="method_type" defaultValue="other">
          <option value="bank_transfer">Bank transfer</option>
          <option value="paypal">PayPal</option>
          <option value="payoneer">Payoneer</option>
          <option value="mobile_money">Mobile money</option>
          <option value="other">Other</option>
        </Select>
        <Input name="destination_label" required placeholder="Destination field label" />
        <Input name="instructions" placeholder="User instructions" className="xl:col-span-2" />
        <Input name="allowed_countries" placeholder="Countries (NG, US) or blank for all" />
        <Input name="allowed_currencies" placeholder="Currencies (USD, NGN) or blank for all" />
        <Input name="sort_order" type="number" min={0} defaultValue={100} />
        <div className="flex flex-wrap items-center gap-4 text-small xl:col-span-3">
          <label className="flex items-center gap-2"><input type="checkbox" name="requires_institution" /> Institution</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="requires_country" /> Country</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="requires_currency" /> Currency</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="requires_review" defaultChecked /> Finance review</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="enabled" defaultChecked /> Enabled</label>
        </div>
        <div className="md:col-span-2 xl:col-span-4">
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add payout method"}</Button>
        </div>
      </form>

      {message ? <p className="text-small text-[var(--nexo-text-muted)]">{message}</p> : null}

      <div className="space-y-3">
        {rows.map((row) => (
          <form
            key={row.id}
            className="grid gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 md:grid-cols-2 xl:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              save(event.currentTarget, row.id);
            }}
          >
            <Input name="code" defaultValue={row.code} required />
            <Input name="display_name" defaultValue={row.display_name} required />
            <Select name="method_type" defaultValue={row.method_type}>
              <option value="bank_transfer">Bank transfer</option>
              <option value="paypal">PayPal</option>
              <option value="payoneer">Payoneer</option>
              <option value="mobile_money">Mobile money</option>
              <option value="other">Other</option>
            </Select>
            <Input name="destination_label" defaultValue={row.destination_label} required />
            <Input name="instructions" defaultValue={row.instructions ?? ""} className="xl:col-span-2" />
            <Input name="allowed_countries" defaultValue={csv(row.allowed_countries)} />
            <Input name="allowed_currencies" defaultValue={csv(row.allowed_currencies)} />
            <Input name="sort_order" type="number" min={0} defaultValue={row.sort_order} />
            <div className="flex flex-wrap items-center gap-4 text-small xl:col-span-3">
              <label className="flex items-center gap-2"><input type="checkbox" name="requires_institution" defaultChecked={row.requires_institution} /> Institution</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="requires_country" defaultChecked={row.requires_country} /> Country</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="requires_currency" defaultChecked={row.requires_currency} /> Currency</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="requires_review" defaultChecked={row.requires_review} /> Finance review</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="enabled" defaultChecked={row.is_enabled} /> Enabled</label>
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-4">
              <Button type="submit" size="sm" disabled={pending}>Save changes</Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await adminTogglePayoutMethodOptionAction({
                      id: row.id,
                      enabled: !row.is_enabled,
                    });
                    setMessage(result.ok ? "Availability updated." : result.error);
                    if (result.ok) router.refresh();
                  })
                }
              >
                {row.is_enabled ? "Disable" : "Enable"}
              </Button>
            </div>
          </form>
        ))}
      </div>
    </section>
  );
}
