"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  adminSavePayoutMethodAction,
  adminSetPayoutMethodStatusAction,
  adminSetPreferredPayoutMethodAction,
} from "@/app/admin/finance/payout-methods/actions";

type Row = {
  id: string;
  user_id: string;
  method_type: string;
  display_name: string;
  beneficiary_name: string;
  country_code: string | null;
  currency: string | null;
  details: Record<string, string>;
  is_preferred: boolean;
  status: string;
  admin_note: string | null;
  profiles?: { email?: string | null; display_name?: string | null; full_name?: string | null } | null;
};

export function AdminPayoutMethodsClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [message, setMessage] = React.useState<string | null>(null);

  return (
    <div className="space-y-6">
      <form
        className="grid gap-2 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          const destination = String(fd.get("destination") || "").trim();
          start(async () => {
            const r = await adminSavePayoutMethodAction({
              userId: String(fd.get("user_id") || ""),
              methodType: String(fd.get("method_type") || "bank_transfer"),
              displayName: String(fd.get("display_name") || ""),
              beneficiaryName: String(fd.get("beneficiary_name") || ""),
              countryCode: String(fd.get("country_code") || ""),
              currency: String(fd.get("currency") || ""),
              details: destination ? { destination } : {},
              preferred: fd.get("preferred") === "on",
            });
            setMessage(r.ok ? "Payout method saved." : r.error);
            if (r.ok) {
              form.reset();
              router.refresh();
            }
          });
        }}
      >
        <h2 className="md:col-span-2 text-h4">Add method for an account</h2>
        <Input name="user_id" required placeholder="Account user UUID" />
        <Select name="method_type" defaultValue="bank_transfer">
          <option value="bank_transfer">Bank transfer</option>
          <option value="paypal">PayPal</option>
          <option value="payoneer">Payoneer</option>
          <option value="mobile_money">Mobile money</option>
          <option value="other">Other</option>
        </Select>
        <Input name="display_name" required placeholder="Method label" />
        <Input name="beneficiary_name" required placeholder="Beneficiary legal name" />
        <Input name="country_code" maxLength={2} placeholder="Country" />
        <Input name="currency" maxLength={3} placeholder="Currency" />
        <Input name="destination" required placeholder="Destination / account details" />
        <label className="flex items-center gap-2 text-small">
          <input type="checkbox" name="preferred" /> Preferred
        </label>
        <div className="md:col-span-2">
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save method"}</Button>
        </div>
      </form>

      {message ? <p className="text-caption text-[var(--nexo-text-muted)]">{message}</p> : null}

      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{row.display_name} {row.is_preferred ? "· Preferred" : ""}</p>
                <p className="text-caption text-[var(--nexo-text-muted)]">
                  {row.profiles?.display_name || row.profiles?.full_name || row.user_id} · {row.profiles?.email || ""}
                </p>
                <p className="text-caption text-[var(--nexo-text-muted)]">
                  {row.method_type.replace(/_/g, " ")} · {row.beneficiary_name} · {row.status}
                  {row.currency ? ` · ${row.currency}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!row.is_preferred && row.status === "active" ? (
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await adminSetPreferredPayoutMethodAction({ id: row.id, userId: row.user_id });
                        setMessage(r.ok ? "Preferred method updated." : r.error);
                        if (r.ok) router.refresh();
                      })
                    }
                  >
                    Make preferred
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const next = row.status === "active" ? "disabled" : "active";
                      const r = await adminSetPayoutMethodStatusAction({
                        id: row.id,
                        userId: row.user_id,
                        status: next,
                      });
                      setMessage(r.ok ? `Method ${next}.` : r.error);
                      if (r.ok) router.refresh();
                    })
                  }
                >
                  {row.status === "active" ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
