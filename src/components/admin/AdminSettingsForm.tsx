"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";
import {
  saveAdminSettingAction,
  savePublicContactMailboxesAction,
} from "@/app/admin/actions";

type SettingRow = { key: string; value: unknown };

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function scalar(value: unknown, fallback: string): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function boolFrom(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return fallback;
}

export function SettingsForm({ settings = [] }: { settings?: SettingRow[] }) {
  const stored = React.useMemo(
    () => new Map(settings.map((row) => [row.key, row.value])),
    [settings]
  );

  const qcDefault = asObject(stored.get("qc.default_priority"));
  const qcAuto = asObject(stored.get("qc.auto_claim"));
  const support = asObject(stored.get("support.sla_hours"));
  const contact = asObject(stored.get("contact.auto_assign"));
  const maintenance = asObject(stored.get("operations.maintenance_notice"));
  const retention = asObject(stored.get("reports.retention_days"));

  const [values, setValues] = React.useState({
    qcPriority: typeof qcDefault.priority === "string" ? qcDefault.priority : "normal",
    qcAutoClaim: boolFrom(qcAuto.enabled, false),
    supportSla: scalar(support.hours, "24"),
    contactAutoAssign: boolFrom(contact.enabled, false),
    maintenanceEnabled: boolFrom(maintenance.enabled, false),
    maintenanceMessage:
      typeof maintenance.message === "string" ? maintenance.message : "",
    retentionDays: scalar(retention.days, "90"),
    minPayoutMinor: scalar(stored.get("finance.min_payout_minor_usd"), "5000"),
    payoutsEnabled: boolFrom(stored.get("finance.payouts_enabled"), true),
  });

  const [pending, setPending] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<{ key: string; ok: boolean; text: string } | null>(null);

  async function save(key: string, value: string | number | boolean | null | Record<string, string | number | boolean | null>) {
    if (pending) return;
    setPending(key);
    setMessage(null);
    const result = await saveAdminSettingAction({ key, value });
    setMessage({
      key,
      ok: result.ok,
      text: result.ok ? "Saved." : result.error,
    });
    setPending(null);
  }

  const feedback = (key: string) =>
    message?.key === key ? (
      <p className={message.ok ? "text-caption text-[var(--nexo-success)]" : "text-caption text-[var(--nexo-error)]"}>
        {message.text}
      </p>
    ) : null;

  return (
    <div className="space-y-6">
      <SettingsGroup title="Quality control" description="Release-review defaults.">
        <SettingRow label="Default QC priority" description="Priority applied when no explicit priority is supplied.">
          <Select
            value={values.qcPriority}
            onChange={(e) => setValues((v) => ({ ...v, qcPriority: e.target.value }))}
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
          <Button
            variant="secondary"
            disabled={pending !== null}
            onClick={() => save("qc.default_priority", { priority: values.qcPriority })}
          >
            {pending === "qc.default_priority" ? "Saving…" : "Save"}
          </Button>
          {feedback("qc.default_priority")}
        </SettingRow>

        <SettingRow label="Automatic QC claiming" description="Controls automatic claiming when the QC workflow supports it.">
          <ToggleSelect
            value={values.qcAutoClaim}
            onChange={(next) => setValues((v) => ({ ...v, qcAutoClaim: next }))}
          />
          <Button
            variant="secondary"
            disabled={pending !== null}
            onClick={() => save("qc.auto_claim", { enabled: values.qcAutoClaim })}
          >
            {pending === "qc.auto_claim" ? "Saving…" : "Save"}
          </Button>
          {feedback("qc.auto_claim")}
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Support & contact" description="Service-level and website-message workflow controls.">
        <SettingRow label="Support SLA" description="Target first-response window, in hours.">
          <Input
            inputMode="numeric"
            value={values.supportSla}
            onChange={(e) => setValues((v) => ({ ...v, supportSla: e.target.value.replace(/\D/g, "") }))}
          />
          <Button
            variant="secondary"
            disabled={pending !== null || !values.supportSla}
            onClick={() => save("support.sla_hours", { hours: Number(values.supportSla) })}
          >
            {pending === "support.sla_hours" ? "Saving…" : "Save"}
          </Button>
          {feedback("support.sla_hours")}
        </SettingRow>

        <SettingRow label="Website message auto-assignment" description="Controls automatic assignment of new website messages.">
          <ToggleSelect
            value={values.contactAutoAssign}
            onChange={(next) => setValues((v) => ({ ...v, contactAutoAssign: next }))}
          />
          <Button
            variant="secondary"
            disabled={pending !== null}
            onClick={() => save("contact.auto_assign", { enabled: values.contactAutoAssign })}
          >
            {pending === "contact.auto_assign" ? "Saving…" : "Save"}
          </Button>
          {feedback("contact.auto_assign")}
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Operations & reports" description="Maintenance communication and report retention.">
        <SettingRow label="Maintenance notice" description="Keep disabled unless an operational maintenance notice is active.">
          <ToggleSelect
            value={values.maintenanceEnabled}
            onChange={(next) => setValues((v) => ({ ...v, maintenanceEnabled: next }))}
          />
          <Textarea
            rows={3}
            value={values.maintenanceMessage}
            onChange={(e) => setValues((v) => ({ ...v, maintenanceMessage: e.target.value }))}
            placeholder="Maintenance notice text"
          />
          <Button
            variant="secondary"
            disabled={pending !== null}
            onClick={() =>
              save("operations.maintenance_notice", {
                enabled: values.maintenanceEnabled,
                message: values.maintenanceMessage.trim(),
              })
            }
          >
            {pending === "operations.maintenance_notice" ? "Saving…" : "Save"}
          </Button>
          {feedback("operations.maintenance_notice")}
        </SettingRow>

        <SettingRow label="Report retention" description="Retention target for generated reports, in days.">
          <Input
            inputMode="numeric"
            value={values.retentionDays}
            onChange={(e) => setValues((v) => ({ ...v, retentionDays: e.target.value.replace(/\D/g, "") }))}
          />
          <Button
            variant="secondary"
            disabled={pending !== null || !values.retentionDays}
            onClick={() => save("reports.retention_days", { days: Number(values.retentionDays) })}
          >
            {pending === "reports.retention_days" ? "Saving…" : "Save"}
          </Button>
          {feedback("reports.retention_days")}
        </SettingRow>
      </SettingsGroup>

      <SettingsGroup title="Finance" description="Existing payout eligibility controls.">
        <SettingRow label="Minimum USD payout" description="Amount in cents. Example: 5000 = $50.00.">
          <Input
            inputMode="numeric"
            value={values.minPayoutMinor}
            onChange={(e) => setValues((v) => ({ ...v, minPayoutMinor: e.target.value.replace(/\D/g, "") }))}
          />
          <Button
            variant="secondary"
            disabled={pending !== null || !values.minPayoutMinor}
            onClick={() => save("finance.min_payout_minor_usd", values.minPayoutMinor)}
          >
            {pending === "finance.min_payout_minor_usd" ? "Saving…" : "Save"}
          </Button>
          {feedback("finance.min_payout_minor_usd")}
        </SettingRow>

        <SettingRow label="Payout requests" description="Master operational switch used by payout eligibility checks.">
          <ToggleSelect
            value={values.payoutsEnabled}
            onChange={(next) => setValues((v) => ({ ...v, payoutsEnabled: next }))}
          />
          <Button
            variant="secondary"
            disabled={pending !== null}
            onClick={() => save("finance.payouts_enabled", String(values.payoutsEnabled))}
          >
            {pending === "finance.payouts_enabled" ? "Saving…" : "Save"}
          </Button>
          {feedback("finance.payouts_enabled")}
        </SettingRow>
      </SettingsGroup>
    </div>
  );
}

export function PublicContactSettingsForm({ initial }: { initial: Record<string, unknown> }) {
  const [form, setForm] = React.useState({
    contactEmail: scalar(initial.contact_email, "support@nexomusicdistribution.com"),
    supportEmail: scalar(initial.support_email, "support@nexomusicdistribution.com"),
    dmcaEmail: scalar(initial.dmca_email, "dmca@nexomusicdistribution.com"),
    inquiriesEmail: scalar(initial.inquiries_email, "support@nexomusicdistribution.com"),
  });
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null);

  return (
    <section className="overflow-hidden rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
      <div className="border-b border-[var(--nexo-border)] bg-[var(--nexo-elevated)]/50 px-5 py-4">
        <h2 className="text-h4">Public contact mailboxes</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          Website-facing addresses only. Personal Gmail/Yahoo-style addresses are rejected.
          SMTP credentials remain server-only.
        </p>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-2">
        {([
          ["contactEmail", "General contact"],
          ["supportEmail", "Artist & label support"],
          ["dmcaEmail", "DMCA / copyright notices"],
          ["inquiriesEmail", "General inquiries"],
        ] as const).map(([key, label]) => (
          <label key={key} className="text-caption font-medium">
            {label}
            <Input
              type="email"
              className="mt-1"
              value={form[key]}
              onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))}
              autoComplete="off"
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--nexo-border)] px-5 py-4">
        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            setMessage(null);
            startTransition(async () => {
              const result = await savePublicContactMailboxesAction(form);
              setMessage({
                ok: result.ok,
                text: result.ok ? "Public mailboxes saved and contact page synchronized." : result.error,
              });
            });
          }}
        >
          {pending ? "Saving…" : "Save public mailboxes"}
        </Button>
        {message ? (
          <span className={message.ok ? "text-caption text-[var(--nexo-success)]" : "text-caption text-[var(--nexo-error)]"}>
            {message.text}
          </span>
        ) : null}
      </div>
    </section>
  );
}

export function SettingsSecurityNotice() {
  return (
    <Alert title="Protected configuration">
      Provider tokens, SMTP passwords, Supabase service-role keys, database passwords, and API
      credentials remain in server secret storage. This page controls only non-secret
      operational settings and public website mailboxes.
    </Alert>
  );
}

function SettingsGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
      <div className="border-b border-[var(--nexo-border)] bg-[var(--nexo-elevated)]/50 px-5 py-4">
        <h2 className="text-h4">{title}</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">{description}</p>
      </div>
      <div className="divide-y divide-[var(--nexo-border)]">{children}</div>
    </section>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-start">
      <div>
        <p className="font-medium text-[var(--nexo-text)]">{label}</p>
        <p className="mt-1 max-w-2xl text-caption text-[var(--nexo-text-muted)]">{description}</p>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ToggleSelect({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Select value={value ? "true" : "false"} onChange={(e) => onChange(e.target.value === "true")}>
      <option value="true">Enabled</option>
      <option value="false">Disabled</option>
    </Select>
  );
}
