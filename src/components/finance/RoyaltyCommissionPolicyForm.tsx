"use client";

import * as React from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { updateRoyaltyCommissionPolicyAction } from "@/app/admin/finance/actions";

type Policy = {
  artistPaidBps: number;
  artistFreeBps: number;
  labelPaidBps: number;
  labelFreeBps: number;
  updatedAt: string | null;
};

type FieldKey =
  | "artistPaidBps"
  | "artistFreeBps"
  | "labelPaidBps"
  | "labelFreeBps";

function percentText(bps: number) {
  return (bps / 100).toFixed(2).replace(/\.00$/, "");
}

function percentToBps(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 99.99) return null;
  return Math.round(parsed * 100);
}

function clientShare(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return Math.max(0, 100 - parsed).toFixed(2).replace(/\.00$/, "") + "%";
}

export function RoyaltyCommissionPolicyForm({
  initial,
}: {
  initial: Policy;
}) {
  const [values, setValues] = React.useState<Record<FieldKey, string>>({
    artistPaidBps: percentText(initial.artistPaidBps),
    artistFreeBps: percentText(initial.artistFreeBps),
    labelPaidBps: percentText(initial.labelPaidBps),
    labelFreeBps: percentText(initial.labelFreeBps),
  });
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<
    { kind: "success" | "error"; text: string } | null
  >(null);
  const [lastSavedAt, setLastSavedAt] = React.useState(initial.updatedAt);

  function update(key: FieldKey, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const artistPaidBps = percentToBps(values.artistPaidBps);
    const artistFreeBps = percentToBps(values.artistFreeBps);
    const labelPaidBps = percentToBps(values.labelPaidBps);
    const labelFreeBps = percentToBps(values.labelFreeBps);

    if (
      artistPaidBps === null ||
      artistFreeBps === null ||
      labelPaidBps === null ||
      labelFreeBps === null
    ) {
      setMessage({
        kind: "error",
        text: "Every Nexo percentage must be between 0.00% and 99.99%.",
      });
      return;
    }

    setPending(true);
    setMessage(null);
    try {
      const result = await updateRoyaltyCommissionPolicyAction({
        artistPaidBps,
        artistFreeBps,
        labelPaidBps,
        labelFreeBps,
        reason,
      });

      if (!result.ok) {
        setMessage({ kind: "error", text: result.error });
        return;
      }

      setValues({
        artistPaidBps: percentText(result.data.artistPaidBps),
        artistFreeBps: percentText(result.data.artistFreeBps),
        labelPaidBps: percentText(result.data.labelPaidBps),
        labelFreeBps: percentText(result.data.labelFreeBps),
      });
      setReason("");
      setLastSavedAt(result.data.updatedAt ?? new Date().toISOString());
      setMessage({
        kind: "success",
        text: "Royalty percentages saved. New royalty postings use these rates immediately.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={save}>
      <Alert title="Prospective commission policy">
        Changes apply to future royalty postings only. Existing posted ledger entries keep the
        commission percentage that was recorded when they were posted. Changing this setting does
        not rewrite historical royalties or amend signed agreements.
      </Alert>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)]">
          <div className="border-b border-[var(--nexo-border)] p-5">
            <p className="text-caption uppercase tracking-[0.12em] text-[var(--nexo-text-muted)]">
              Artists
            </p>
            <h2 className="mt-1 text-h4">Artist royalty commission</h2>
            <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
              Paid artist = active Artist Pro. Free artist = Artist Starter or no active paid artist plan.
            </p>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <PercentField
              label="Paid plan artist"
              description="Nexo percentage for active Artist Pro accounts."
              value={values.artistPaidBps}
              onChange={(value) => update("artistPaidBps", value)}
            />
            <PercentField
              label="Free plan artist"
              description="Nexo percentage for Artist Starter or no active paid artist plan."
              value={values.artistFreeBps}
              onChange={(value) => update("artistFreeBps", value)}
            />
          </div>
        </section>

        <section className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)]">
          <div className="border-b border-[var(--nexo-border)] p-5">
            <p className="text-caption uppercase tracking-[0.12em] text-[var(--nexo-text-muted)]">
              Labels
            </p>
            <h2 className="mt-1 text-h4">Label royalty commission</h2>
            <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
              Paid label groups Label Starter and Label Pro together. Free label covers label accounts with no active paid label plan.
            </p>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <PercentField
              label="Paid plan label"
              description="Nexo percentage for active Label Starter and Label Pro accounts."
              value={values.labelPaidBps}
              onChange={(value) => update("labelPaidBps", value)}
            />
            <PercentField
              label="Free plan label"
              description="Nexo percentage for a label account without an active paid label plan."
              value={values.labelFreeBps}
              onChange={(value) => update("labelFreeBps", value)}
            />
          </div>
        </section>
      </div>

      <section className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="block text-caption font-medium">
            Internal change note
            <Textarea
              className="mt-1"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Optional reason for this commission change"
            />
          </label>
          <div className="min-w-[13rem]">
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Saving percentages…" : "Save royalty percentages"}
            </Button>
            <p className="mt-2 text-center text-[11px] text-[var(--nexo-text-muted)]">
              {lastSavedAt
                ? "Last updated " + new Date(lastSavedAt).toLocaleString()
                : "No update timestamp available"}
            </p>
          </div>
        </div>
      </section>

      {message ? (
        <Alert variant={message.kind === "error" ? "warning" : "default"}>
          {message.text}
        </Alert>
      ) : null}
    </form>
  );
}

function PercentField({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] p-4">
      <span className="text-small font-semibold text-[var(--nexo-text)]">{label}</span>
      <span className="mt-1 block min-h-10 text-caption text-[var(--nexo-text-muted)]">
        {description}
      </span>
      <span className="mt-4 flex items-center gap-2">
        <Input
          type="number"
          min="0"
          max="99.99"
          step="0.01"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label + " Nexo percentage"}
        />
        <span className="text-small font-semibold">%</span>
      </span>
      <span className="mt-3 grid grid-cols-2 gap-2 text-caption">
        <span className="rounded-[var(--nexo-radius-sm)] bg-[var(--nexo-elevated)] p-2">
          <span className="block text-[var(--nexo-text-muted)]">Nexo keeps</span>
          <strong className="mt-0.5 block text-[var(--nexo-text)]">{value || "—"}%</strong>
        </span>
        <span className="rounded-[var(--nexo-radius-sm)] bg-[var(--nexo-elevated)] p-2">
          <span className="block text-[var(--nexo-text-muted)]">Client receives</span>
          <strong className="mt-0.5 block text-[var(--nexo-text)]">{clientShare(value)}</strong>
        </span>
      </span>
    </label>
  );
}
