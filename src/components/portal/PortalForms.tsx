"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import {
  assignSplitToTrackAction,
  createMusicVideoAction,
  createPayeeAction,
  createPayoutRequestAction,
  createRecoupmentAction,
  createSplitRuleAction,
  inviteAccountMemberAction,
  requestEnrollmentAction,
  saveTaxDetailsAction,
} from "@/app/(portal)/portal-actions";
import type { SplitShareInput } from "@/lib/finance/splits";
import { formatMinorUnits, parseMajorUnitsToMinor, currencyFractionDigits } from "@/lib/finance/money";

function usePendingAction() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState(false);
  async function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, form?: HTMLFormElement) {
    if (pending) return;
    setPending(true);
    setError(null);
    setOk(false);
    const res = await fn();
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    form?.reset();
    setOk(true);
    router.refresh();
  }
  return { pending, error, ok, run };
}

export function MusicVideoForm({
  releases,
}: {
  releases: { id: string; title: string | null }[];
}) {
  const s = usePendingAction();
  return (
    <form
      className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const form = e.currentTarget;
        void s.run(async () => {
          const r = await createMusicVideoAction({
            title: String(fd.get("title") || ""),
            video_url: String(fd.get("video_url") || ""),
            notes: String(fd.get("notes") || ""),
            release_id: String(fd.get("release_id") || "") || undefined,
          });
          return r.ok ? { ok: true } : r;
        }, form);
      }}
    >
      <h2 className="text-h4">Submit music video</h2>
      {s.error ? <Alert variant="warning">{s.error}</Alert> : null}
      {s.ok ? <Alert variant="success">Submitted for review.</Alert> : null}
      <Input name="title" required placeholder="Video title" />
      <Input name="video_url" required placeholder="https://…" aria-label="Video URL" />
      <Select name="release_id">
        <option value="">Unlinked release</option>
        {releases.map((r) => (
          <option key={r.id} value={r.id}>
            {r.title || "Untitled"}
          </option>
        ))}
      </Select>
      <Textarea name="notes" placeholder="Notes" />
      <Button type="submit" disabled={s.pending}>
        {s.pending ? "Submitting…" : "Submit video"}
      </Button>
    </form>
  );
}

export function PayeeForm() {
  const s = usePendingAction();
  return (
    <form
      className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const form = e.currentTarget;
        void s.run(async () => {
          const r = await createPayeeAction({
            name: String(fd.get("name") || ""),
            email: String(fd.get("email") || ""),
            role_label: String(fd.get("role_label") || "other"),
          });
          return r.ok ? { ok: true } : r;
        }, form);
      }}
    >
      <h2 className="text-h4">Add payee</h2>
      <p className="text-caption text-[var(--nexo-text-muted)]">
        Email is required so the payee can be linked to the correct account. External payees can still accrue a held payable balance.
      </p>
      {s.error ? <Alert variant="warning">{s.error}</Alert> : null}
      {s.ok ? <Alert variant="success">Payee submitted for review.</Alert> : null}
      <Input name="name" required placeholder="Legal / payee name" />
      <Input name="email" type="email" required placeholder="Payee email" />
      <Select name="role_label" defaultValue="other">
        <option value="artist">Artist</option>
        <option value="label">Label</option>
        <option value="producer">Producer</option>
        <option value="songwriter">Songwriter</option>
        <option value="featured">Featured artist</option>
        <option value="publisher">Publisher</option>
        <option value="other">Other</option>
      </Select>
      <Button type="submit" disabled={s.pending}>
        {s.pending ? "Submitting…" : "Submit payee"}
      </Button>
    </form>
  );
}

export function SplitRuleForm({
  payees,
}: {
  payees: {
    id: string;
    name: string;
    email: string;
    roleLabel: SplitShareInput["partyRole"];
  }[];
}) {
  const s = usePendingAction();
  const [rows, setRows] = React.useState([{ payeeId: "", percent: "100.00" }]);

  return (
    <form
      className="space-y-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const form = e.currentTarget;
        void s.run(async () => {
          const shares: SplitShareInput[] = rows.map((row) => {
            const payee = payees.find((item) => item.id === row.payeeId);
            const shareBps = Math.round(Number(row.percent) * 100);
            return {
              payeeId: row.payeeId,
              partyName: payee?.name ?? "",
              partyRole: payee?.roleLabel ?? "other",
              partyUserId: null,
              shareBps,
            };
          });
          const r = await createSplitRuleAction({
            name: String(fd.get("name") || ""),
            effectiveFrom: String(fd.get("effective_from") || ""),
            shares,
          });
          return r.ok ? { ok: true } : r;
        }, form);
      }}
    >
      <div>
        <h2 className="text-h4">New split rule</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          Use approved payees only. All shares must total exactly 100.00%.
        </p>
      </div>
      {s.error ? <Alert variant="warning">{s.error}</Alert> : null}
      {s.ok ? <Alert variant="success">Split submitted for admin review.</Alert> : null}
      <Input name="name" required placeholder="Rule name" />
      <Input name="effective_from" type="date" aria-label="Effective from" />

      {payees.length === 0 ? (
        <Alert variant="warning">You need at least one approved payee before creating a split.</Alert>
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-[1fr_9rem_auto]">
              <Select
                value={row.payeeId}
                onChange={(event) =>
                  setRows((current) =>
                    current.map((item, i) => (i === index ? { ...item, payeeId: event.target.value } : item))
                  )
                }
                required
                aria-label={`Payee ${index + 1}`}
              >
                <option value="">Select payee</option>
                {payees.map((payee) => (
                  <option key={payee.id} value={payee.id}>
                    {payee.name} · {payee.email}
                  </option>
                ))}
              </Select>
              <Input
                value={row.percent}
                onChange={(event) =>
                  setRows((current) =>
                    current.map((item, i) => (i === index ? { ...item, percent: event.target.value } : item))
                  )
                }
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                required
                aria-label={`Payee ${index + 1} percentage`}
              />
              <button
                type="button"
                className="rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] px-3 py-2 text-small disabled:opacity-40"
                disabled={rows.length === 1}
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-small font-medium underline underline-offset-4"
            onClick={() => setRows((current) => [...current, { payeeId: "", percent: "0.00" }])}
          >
            + Add payee share
          </button>
        </div>
      )}

      <Button type="submit" disabled={s.pending || payees.length === 0}>
        {s.pending ? "Submitting…" : "Submit split"}
      </Button>
    </form>
  );
}

export function AssignmentForm({
  tracks,
  rules,
}: {
  tracks: { id: string; title: string | null }[];
  rules: { id: string; name: string }[];
}) {
  const s = usePendingAction();
  if (tracks.length === 0 || rules.length === 0) {
    return (
      <p className="text-small text-[var(--nexo-text-muted)]">
        Create a split rule and at least one track before assigning.
      </p>
    );
  }
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const form = e.currentTarget;
        void s.run(async () => {
          const r = await assignSplitToTrackAction({
            track_id: String(fd.get("track_id") || ""),
            split_rule_id: String(fd.get("split_rule_id") || ""),
          });
          return r.ok ? { ok: true } : r;
        }, form);
      }}
    >
      {s.error ? <span className="w-full text-caption text-[var(--nexo-error)]">{s.error}</span> : null}
      {s.ok ? <span className="w-full text-caption text-[var(--nexo-success)]">Assignment submitted for review.</span> : null}
      <Select name="track_id" required className="min-w-[12rem] flex-1">
        {tracks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title || "Untitled track"}
          </option>
        ))}
      </Select>
      <Select name="split_rule_id" required className="min-w-[12rem] flex-1">
        {rules.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </Select>
      <Button type="submit" disabled={s.pending}>
        {s.pending ? "Submitting…" : "Submit assignment"}
      </Button>
    </form>
  );
}

export function RecoupmentForm({
  payees,
  tracks,
}: {
  payees: { id: string; name: string; email: string }[];
  tracks: { id: string; title: string | null }[];
}) {
  const s = usePendingAction();
  return (
    <form
      className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const form = e.currentTarget;
        void s.run(async () => {
          const r = await createRecoupmentAction({
            title: String(fd.get("title") || ""),
            amountMinor: parseMajorUnitsToMinor(String(fd.get("amount_display") || ""), String(fd.get("currency") || "USD")) ?? 0,
            currency: String(fd.get("currency") || "USD"),
            notes: String(fd.get("notes") || ""),
            payee_id: String(fd.get("payee_id") || ""),
            track_id: String(fd.get("track_id") || "") || undefined,
          });
          return r.ok ? { ok: true } : r;
        }, form);
      }}
    >
      <h2 className="text-h4">Submit recoupment</h2>
      <p className="text-caption text-[var(--nexo-text-muted)]">
        Approved recoupments are deducted from this payee&apos;s future SplitShare allocation before their payable amount is credited or held.
      </p>
      {s.error ? <Alert variant="warning">{s.error}</Alert> : null}
      {s.ok ? <Alert variant="success">Recoupment submitted for review.</Alert> : null}
      <Select name="payee_id" required defaultValue="">
        <option value="" disabled>Select approved payee</option>
        {payees.map((payee) => (
          <option key={payee.id} value={payee.id}>{payee.name} · {payee.email}</option>
        ))}
      </Select>
      <Select name="track_id" defaultValue="">
        <option value="">All assigned tracks for this payee</option>
        {tracks.map((track) => (
          <option key={track.id} value={track.id}>{track.title || "Untitled track"}</option>
        ))}
      </Select>
      <Input name="title" required placeholder="Advance / recoupable cost name" />
      <Input name="amount_display" type="number" required min="0.01" step="0.01" placeholder="Amount" />
      <Input name="currency" defaultValue="USD" maxLength={3} />
      <Textarea name="notes" placeholder="Agreement / recoupment notes" />
      <Button type="submit" disabled={s.pending || payees.length === 0}>
        {s.pending ? "Submitting…" : "Submit recoupment"}
      </Button>
    </form>
  );
}
export function MemberInviteForm() {
  const s = usePendingAction();
  return (
    <form
      className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const form = e.currentTarget;
        void s.run(async () => {
          const r = await inviteAccountMemberAction({
            email: String(fd.get("email") || ""),
            display_name: String(fd.get("display_name") || ""),
            role_label: String(fd.get("role_label") || "member"),
          });
          return r.ok ? { ok: true } : r;
        }, form);
      }}
    >
      <h2 className="text-h4">Invite member</h2>
      {s.error ? <Alert variant="warning">{s.error}</Alert> : null}
      {s.ok ? <Alert variant="success">Invite recorded.</Alert> : null}
      <Input name="email" type="email" required placeholder="email@example.com" />
      <Input name="display_name" placeholder="Display name" />
      <Select name="role_label" defaultValue="member">
        <option value="member">Member</option>
        <option value="finance">Finance</option>
        <option value="catalog">Catalog</option>
      </Select>
      <Button type="submit" disabled={s.pending}>
        {s.pending ? "Saving…" : "Invite"}
      </Button>
    </form>
  );
}

export function TaxDetailsForm({
  initial,
}: {
  initial: { legal_name: string | null; country: string | null; tax_id: string | null } | null;
}) {
  const s = usePendingAction();
  return (
    <form
      className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        void s.run(async () => {
          const r = await saveTaxDetailsAction({
            legal_name: String(fd.get("legal_name") || ""),
            country: String(fd.get("country") || ""),
            tax_id: String(fd.get("tax_id") || ""),
          });
          return r.ok ? { ok: true } : r;
        });
      }}
    >
      <h2 className="text-h4">Tax details</h2>
      {s.error ? <Alert variant="warning">{s.error}</Alert> : null}
      {s.ok ? <Alert variant="success">Saved.</Alert> : null}
      <Input name="legal_name" defaultValue={initial?.legal_name ?? ""} placeholder="Legal name" />
      <Input name="country" defaultValue={initial?.country ?? ""} placeholder="Country (ISO-2)" maxLength={2} />
      <Input name="tax_id" defaultValue={initial?.tax_id ?? ""} placeholder="Tax ID (stored privately)" />
      <Button type="submit" disabled={s.pending}>
        {s.pending ? "Saving…" : "Save tax details"}
      </Button>
    </form>
  );
}

export function EnrollmentButton({ serviceKey, enrolled }: { serviceKey: string; enrolled: boolean }) {
  const s = usePendingAction();
  if (enrolled) return <span className="text-caption text-[var(--nexo-text-muted)]">Requested / enrolled</span>;
  return (
    <Button
      type="button"
      size="sm"
      disabled={s.pending}
      onClick={() => {
        void s.run(async () => {
          const r = await requestEnrollmentAction(serviceKey);
          return r.ok ? { ok: true } : r;
        });
      }}
    >
      {s.pending ? "…" : "Request"}
    </Button>
  );
}

export function PayoutRequestForm({
  availableMinor,
  currency,
  payoutMethods,
}: {
  availableMinor: number;
  currency: string;

  payoutMethods: Array<{
    id: string;
    label: string;
    methodType: string;
    destinationMask: string;
    currency: string | null;
    preferred: boolean;
  }>;
}) {
  const s = usePendingAction();
  const orderedMethods = [...payoutMethods].sort(
    (a, b) => Number(b.preferred) - Number(a.preferred)
  );
  return (
    <form
      className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const form = e.currentTarget;
        void s.run(async () => {
          const r = await createPayoutRequestAction({
            amountMinor: parseMajorUnitsToMinor(
              String(fd.get("amount_display") || ""),
              currency
            ) ?? 0,
            currency,
            payoutMethodId: String(fd.get("payout_method_id") || ""),
          });
          return r.ok ? { ok: true } : r;
        }, form);
      }}
    >
      <h2 className="text-h4">Request payment</h2>

      {s.error ? <Alert variant="error">{s.error}</Alert> : null}
      {s.ok ? <Alert variant="success">Payout request submitted.</Alert> : null}
      <p className="text-caption text-[var(--nexo-text-muted)]">
        Available balance: {formatMinorUnits(availableMinor, currency)}
      </p>
      <label className="block space-y-1">
        <span className="text-caption text-[var(--nexo-text-muted)]">
          Payout amount ({currency})
        </span>
        <Input
          name="amount_display"
          type="number"
          required
          min={
            currencyFractionDigits(currency) === 0
              ? 1
              : 1 / 10 ** currencyFractionDigits(currency)
          }
          max={availableMinor / 10 ** currencyFractionDigits(currency)}
          step={
            currencyFractionDigits(currency) === 0
              ? 1
              : 1 / 10 ** currencyFractionDigits(currency)
          }
          placeholder={currencyFractionDigits(currency) === 0 ? "0" : "0.00"}
        />
      </label>
      {orderedMethods.length > 0 ? (
        <label className="block space-y-1">
          <span className="text-caption text-[var(--nexo-text-muted)]">
            Approved payout method
          </span>
          <Select
            name="payout_method_id"
            required
            defaultValue={orderedMethods.find((method) => method.preferred)?.id ?? orderedMethods[0]?.id}
          >
            {orderedMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.label} · {method.destinationMask}
                {method.currency ? ` · ${method.currency}` : ""}
              </option>
            ))}
          </Select>
        </label>
      ) : (
        <Alert variant="warning">
          Add and verify a payout method before requesting payment.
        </Alert>
      )}
      <Button
        type="submit"
        disabled={s.pending || availableMinor <= 0 || orderedMethods.length === 0}
      >
        {s.pending ? "Submitting…" : "Request payment"}
      </Button>
    </form>
  );
}
