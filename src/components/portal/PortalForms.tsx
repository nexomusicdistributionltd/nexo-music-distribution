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
import { currencyFractionDigits, minorUnitsToInputValue, parseMajorToMinorUnits } from "@/lib/finance/money";

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
      {s.error ? <Alert variant="warning">{s.error}</Alert> : null}
      {s.ok ? <Alert variant="success">Payee saved.</Alert> : null}
      <Input name="name" required placeholder="Name" />
      <Input name="email" type="email" placeholder="Email (optional)" />
      <Select name="role_label" defaultValue="other">
        <option value="artist">Artist</option>
        <option value="label">Label</option>
        <option value="producer">Producer</option>
        <option value="songwriter">Songwriter</option>
        <option value="other">Other</option>
      </Select>
      <Button type="submit" disabled={s.pending}>
        {s.pending ? "Saving…" : "Save payee"}
      </Button>
    </form>
  );
}

export function SplitRuleForm() {
  const s = usePendingAction();
  return (
    <form
      className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const form = e.currentTarget;
        const bpsA = Math.trunc(Number(fd.get("share_a_bps")));
        const bpsB = Math.trunc(Number(fd.get("share_b_bps")));
        void s.run(async () => {
          const shares: SplitShareInput[] = [];
          const partyA = String(fd.get("party_a") || "").trim();
          const partyB = String(fd.get("party_b") || "").trim();
          if (partyA && bpsA > 0) {
            shares.push({ partyName: partyA, partyRole: "artist", shareBps: bpsA });
          }
          if (partyB && bpsB > 0) {
            shares.push({ partyName: partyB, partyRole: "other", shareBps: bpsB });
          }
          const r = await createSplitRuleAction({
            name: String(fd.get("name") || ""),
            effectiveFrom: String(fd.get("effective_from") || ""),
            shares,
          });
          return r.ok ? { ok: true } : r;
        }, form);
      }}
    >
      <h2 className="text-h4">New split rule</h2>
      <p className="text-caption text-[var(--nexo-text-muted)]">Shares must total 10,000 bps (100%).</p>
      {s.error ? <Alert variant="warning">{s.error}</Alert> : null}
      {s.ok ? <Alert variant="success">Split saved.</Alert> : null}
      <Input name="name" required placeholder="Rule name" />
      <Input name="effective_from" type="date" aria-label="Effective from" />
      <Input name="party_a" required placeholder="Party A name" />
      <Input name="share_a_bps" type="number" required defaultValue={10000} aria-label="Party A bps" />
      <Input name="party_b" placeholder="Party B name (optional)" />
      <Input name="share_b_bps" type="number" defaultValue={0} aria-label="Party B bps" />
      <Button type="submit" disabled={s.pending}>
        {s.pending ? "Saving…" : "Save split"}
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
        {s.pending ? "Saving…" : "Assign"}
      </Button>
    </form>
  );
}

export function RecoupmentForm() {
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
            amountMinor: Number(fd.get("amount_minor")),
            currency: String(fd.get("currency") || "USD"),
            notes: String(fd.get("notes") || ""),
          });
          return r.ok ? { ok: true } : r;
        }, form);
      }}
    >
      <h2 className="text-h4">Record recoupment</h2>
      {s.error ? <Alert variant="warning">{s.error}</Alert> : null}
      {s.ok ? <Alert variant="success">Saved.</Alert> : null}
      <Input name="title" required placeholder="Advance / cost name" />
      <Input name="amount_minor" type="number" required min={1} step={1} placeholder="Amount in minor units (e.g. 10000 = $100.00)" />
      <Input name="currency" defaultValue="USD" maxLength={3} />
      <Textarea name="notes" placeholder="Notes" />
      <Button type="submit" disabled={s.pending}>
        {s.pending ? "Saving…" : "Save recoupment"}
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
  paymentMessage,
}: {
  availableMinor: number;
  currency: string;
  paymentMessage: string;
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
          const parsedAmount = parseMajorToMinorUnits(
            String(fd.get("amount_display") || ""),
            currency
          );
          if (parsedAmount == null) {
            return { ok: false as const, error: "Enter a valid payout amount for this currency." };
          }
          const r = await createPayoutRequestAction({
            amountMinor: parsedAmount,
            currency,
            method_note: String(fd.get("method_note") || ""),
          });
          return r.ok ? { ok: true } : r;
        }, form);
      }}
    >
      <h2 className="text-h4">Request payment</h2>
      <Alert variant="warning">{paymentMessage}</Alert>
      {s.error ? <Alert variant="error">{s.error}</Alert> : null}
      {s.ok ? <Alert variant="success">Request submitted for staff review.</Alert> : null}
      <p className="text-caption text-[var(--nexo-text-muted)]">Available balance: {new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: currencyFractionDigits(currency), maximumFractionDigits: currencyFractionDigits(currency) }).format(Number(minorUnitsToInputValue(availableMinor, currency)))}</p>
      <label className="block space-y-1"><span className="text-caption text-[var(--nexo-text-muted)]">Payout amount ({currency})</span><Input
        name="amount_display"
        type="number"
        required
        min={currencyFractionDigits(currency) === 0 ? "1" : `0.${"0".repeat(Math.max(0, currencyFractionDigits(currency) - 1))}1`}
        max={minorUnitsToInputValue(availableMinor, currency)}
        step={currencyFractionDigits(currency) === 0 ? "1" : `0.${"0".repeat(Math.max(0, currencyFractionDigits(currency) - 1))}1`}
        placeholder={currencyFractionDigits(currency) === 0 ? "0" : `0.${"0".repeat(currencyFractionDigits(currency))}`}
      /></label>
      <Input name="method_note" placeholder="Method note (optional)" />
      <Button type="submit" disabled={s.pending || availableMinor <= 0}>
        {s.pending ? "Submitting…" : "Request payment"}
      </Button>
    </form>
  );
}
