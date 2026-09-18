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
  releases: Array<{
    id: string;
    title: string | null;
    primary_artist_name?: string | null;
  }>;
}) {
  const s = usePendingAction();
  const [releaseId, setReleaseId] = React.useState("");
  const [primaryArtistName, setPrimaryArtistName] = React.useState("");

  return (
    <form
      className="space-y-5 rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const form = e.currentTarget;
        void s.run(async () => {
          const r = await createMusicVideoAction({
            title: String(fd.get("title") || ""),
            video_url: String(fd.get("video_url") || ""),
            primary_artist_name: String(fd.get("primary_artist_name") || ""),
            genre: String(fd.get("genre") || ""),
            language: String(fd.get("language") || ""),
            release_date: String(fd.get("release_date") || ""),
            video_type: String(fd.get("video_type") || ""),
            age_restriction: String(fd.get("age_restriction") || ""),
            is_cover_version: fd.get("is_cover_version") === "on",
            reference_upc: String(fd.get("reference_upc") || ""),
            reference_isrc: String(fd.get("reference_isrc") || ""),
            deliver_apple_music: fd.get("deliver_apple_music") === "on",
            deliver_vevo: fd.get("deliver_vevo") === "on",
            confirm_rights: fd.get("confirm_rights") === "on",
            notes: String(fd.get("notes") || ""),
            release_id: String(fd.get("release_id") || "") || undefined,
          });
          return r.ok ? { ok: true } : r;
        }, form);
      }}
    >
      <div>
        <h2 className="text-h4">Music video distribution</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          Submit complete video metadata for Nexo review. Provider delivery starts only after staff approval.
        </p>
      </div>
      {s.error ? <Alert variant="warning">{s.error}</Alert> : null}
      {s.ok ? (
        <Alert variant="success">
          Submitted for Nexo review. You can track provider submission on this page after approval.
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-caption text-[var(--nexo-text-muted)]">Video title *</span>
          <Input name="title" required placeholder="Official video title" />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-caption text-[var(--nexo-text-muted)]">HTTPS video source URL *</span>
          <Input name="video_url" type="url" required placeholder="https://…" />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-caption text-[var(--nexo-text-muted)]">Link to an existing release</span>
          <Select
            name="release_id"
            value={releaseId}
            onChange={(e) => {
              const id = e.target.value;
              setReleaseId(id);
              const release = releases.find((item) => item.id === id);
              if (release?.primary_artist_name) setPrimaryArtistName(release.primary_artist_name);
            }}
          >
            <option value="">Standalone music video</option>
            {releases.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title || "Untitled"}
              </option>
            ))}
          </Select>
        </label>
        <label className="block space-y-1">
          <span className="text-caption text-[var(--nexo-text-muted)]">Primary artist *</span>
          <Input
            name="primary_artist_name"
            required
            value={primaryArtistName}
            onChange={(e) => setPrimaryArtistName(e.target.value)}
            placeholder="Artist name"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-caption text-[var(--nexo-text-muted)]">Release date</span>
          <Input name="release_date" type="date" />
        </label>
        <Input name="genre" placeholder="Primary genre" />
        <Input name="language" placeholder="Language" />
        <Input name="video_type" placeholder="Video type (e.g. Music Video)" />
        <Input name="age_restriction" placeholder="Age restriction (if applicable)" />
        <Input name="reference_upc" inputMode="numeric" placeholder="Reference UPC (optional)" />
        <Input
          name="reference_isrc"
          placeholder="Reference ISRC (optional)"
          onInput={(e) => {
            e.currentTarget.value = e.currentTarget.value.toUpperCase();
          }}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-small">
          <input name="deliver_apple_music" type="checkbox" defaultChecked />
          <span>Deliver to Apple Music when provider access allows</span>
        </label>
        <label className="flex items-center gap-2 text-small">
          <input name="deliver_vevo" type="checkbox" defaultChecked />
          <span>Deliver to VEVO when provider access allows</span>
        </label>
        <label className="flex items-center gap-2 text-small">
          <input name="is_cover_version" type="checkbox" />
          <span>This video is a cover version</span>
        </label>
      </div>

      <Textarea name="notes" placeholder="Clearance, delivery, or review notes" />

      <label className="flex items-start gap-2 rounded-[var(--nexo-radius)] bg-[var(--nexo-elevated)] p-3">
        <input className="mt-1" name="confirm_rights" type="checkbox" required />
        <span className="text-small">
          I confirm I control the rights necessary to distribute this music video and authorize Nexo to deliver it.
        </span>
      </label>

      <Button type="submit" disabled={s.pending}>
        {s.pending ? "Submitting…" : "Submit video for review"}
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
            amountMinor: parseMajorUnitsToMinor(String(fd.get("amount_display") || ""), String(fd.get("currency") || "USD")) ?? 0,
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
      <Input name="amount_display" type="number" required min="0.01" step="0.01" placeholder="Amount" />
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
  payoutMethods,
}: {
  availableMinor: number;
  currency: string;
  paymentMessage: string;
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
      <Alert>{paymentMessage}</Alert>
      {s.error ? <Alert variant="error">{s.error}</Alert> : null}
      {s.ok ? <Alert variant="success">Request submitted for Nexo Finance review.</Alert> : null}
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
          Add a payout method above and wait for Nexo Finance approval before requesting payment.
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
