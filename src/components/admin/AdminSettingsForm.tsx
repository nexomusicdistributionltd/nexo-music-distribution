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

type SettingDefinition = {
  key:
    | "qc.default_priority"
    | "qc.auto_claim"
    | "support.sla_hours"
    | "contact.auto_assign"
    | "operations.maintenance_notice"
    | "reports.retention_days"
    | "finance.min_payout_minor_usd"
    | "finance.payouts_enabled";
  label: string;
  description: string;
  category: "Quality & workflow" | "Support & communications" | "Operations & reporting" | "Finance";
  kind: "text" | "number" | "boolean" | "priority";
  defaultValue: string;
};

const SETTINGS: SettingDefinition[] = [
  {
    key: "qc.default_priority",
    label: "Default QC priority",
    description: "Priority assigned to new QC work when no explicit priority is supplied.",
    category: "Quality & workflow",
    kind: "priority",
    defaultValue: "normal",
  },
  {
    key: "qc.auto_claim",
    label: "QC auto-claim",
    description: "Controls whether eligible QC work may be automatically claimed by the configured workflow.",
    category: "Quality & workflow",
    kind: "boolean",
    defaultValue: "false",
  },
  {
    key: "support.sla_hours",
    label: "Support SLA",
    description: "Target first-response window for support tickets, in hours.",
    category: "Support & communications",
    kind: "number",
    defaultValue: "24",
  },
  {
    key: "contact.auto_assign",
    label: "Website message auto-assignment",
    description: "Controls automatic assignment behavior for new website contact messages.",
    category: "Support & communications",
    kind: "boolean",
    defaultValue: "false",
  },
  {
    key: "operations.maintenance_notice",
    label: "Maintenance notice",
    description: "Internal operational notice text. Keep blank when no maintenance notice is active.",
    category: "Operations & reporting",
    kind: "text",
    defaultValue: "",
  },
  {
    key: "reports.retention_days",
    label: "Report retention",
    description: "Retention target for generated operational report exports, in days.",
    category: "Operations & reporting",
    kind: "number",
    defaultValue: "90",
  },
  {
    key: "finance.min_payout_minor_usd",
    label: "Minimum USD payout",
    description: "Minimum payout amount in minor USD units. 5000 means $50.00.",
    category: "Finance",
    kind: "number",
    defaultValue: "5000",
  },
  {
    key: "finance.payouts_enabled",
    label: "Payout requests",
    description: "Master operational switch for new payout eligibility checks.",
    category: "Finance",
    kind: "boolean",
    defaultValue: "true",
  },
];

const CATEGORIES = [
  "Quality & workflow",
  "Support & communications",
  "Operations & reporting",
  "Finance",
] as const;

function settingText(value: unknown, fallback: string) {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && !Array.isArray(value)) {
    const row = value as Record<string, unknown>;
    if ("value" in row && (typeof row.value === "string" || typeof row.value === "number" || typeof row.value === "boolean")) {
      return String(row.value);
    }
  }
  return fallback;
}

export function SettingsForm({
  initialSettings,
}: {
  initialSettings: Record<string, unknown>;
}) {
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(
      SETTINGS.map((setting) => [
        setting.key,
        settingText(initialSettings[setting.key], setting.defaultValue),
      ])
    )
  );
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<{ key: string; text: string; ok: boolean } | null>(null);

  async function save(setting: SettingDefinition) {
    if (pendingKey) return;
    setPendingKey(setting.key);
    setMessage(null);

    const value = values[setting.key] ?? setting.defaultValue;
    if (setting.kind === "number" && (!/^\d+$/.test(value) || Number(value) < 0)) {
      setMessage({ key: setting.key, text: "Enter a valid non-negative number.", ok: false });
      setPendingKey(null);
      return;
    }

    const result = await saveAdminSettingAction({
      key: setting.key,
      value,
    });

    setMessage({
      key: setting.key,
      text: result.ok ? "Saved." : result.error,
      ok: result.ok,
    });
    setPendingKey(null);
  }

  return (
    <div className="space-y-6">
      {CATEGORIES.map((category) => (
        <section
          key={category}
          className="overflow-hidden rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)]"
        >
          <div className="border-b border-[var(--nexo-border)] bg-[var(--nexo-elevated)]/45 px-5 py-4">
            <h2 className="text-h4">{category}</h2>
          </div>
          <div className="divide-y divide-[var(--nexo-border)]">
            {SETTINGS.filter((setting) => setting.category === category).map((setting) => (
              <div
                key={setting.key}
                className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,22rem)] lg:items-center"
              >
                <div className="min-w-0">
                  <p className="font-medium text-[var(--nexo-text)]">{setting.label}</p>
                  <p className="mt-1 max-w-2xl text-caption text-[var(--nexo-text-muted)]">
                    {setting.description}
                  </p>
                  <code className="mt-2 inline-block text-[0.68rem] text-[var(--nexo-text-muted)]">
                    {setting.key}
                  </code>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    {setting.kind === "boolean" ? (
                      <Select
                        value={values[setting.key] ?? setting.defaultValue}
                        onChange={(e) =>
                          setValues((current) => ({ ...current, [setting.key]: e.target.value }))
                        }
                        aria-label={setting.label}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </Select>
                    ) : setting.kind === "priority" ? (
                      <Select
                        value={values[setting.key] ?? setting.defaultValue}
                        onChange={(e) =>
                          setValues((current) => ({ ...current, [setting.key]: e.target.value }))
                        }
                        aria-label={setting.label}
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </Select>
                    ) : setting.kind === "text" ? (
                      <Textarea
                        rows={3}
                        value={values[setting.key] ?? setting.defaultValue}
                        onChange={(e) =>
                          setValues((current) => ({ ...current, [setting.key]: e.target.value }))
                        }
                        aria-label={setting.label}
                      />
                    ) : (
                      <Input
                        inputMode="numeric"
                        value={values[setting.key] ?? setting.defaultValue}
                        onChange={(e) =>
                          setValues((current) => ({ ...current, [setting.key]: e.target.value }))
                        }
                        aria-label={setting.label}
                      />
                    )}

                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pendingKey !== null}
                      onClick={() => save(setting)}
                    >
                      {pendingKey === setting.key ? "Saving…" : "Save"}
                    </Button>
                  </div>

                  {message?.key === setting.key ? (
                    <p
                      className={
                        message.ok
                          ? "text-caption text-[var(--nexo-success)]"
                          : "text-caption text-[var(--nexo-error)]"
                      }
                    >
                      {message.text}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function PublicContactSettingsForm({
  initial,
}: {
  initial: Record<string, unknown>;
}) {
  const [form, setForm] = React.useState({
    contactEmail: settingText(initial.contact_email, "support@nexomusicdistribution.com"),
    supportEmail: settingText(initial.support_email, "support@nexomusicdistribution.com"),
    dmcaEmail: settingText(initial.dmca_email, "dmca@nexomusicdistribution.com"),
    inquiriesEmail: settingText(initial.inquiries_email, "support@nexomusicdistribution.com"),
  });
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<{ text: string; ok: boolean } | null>(null);

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await savePublicContactMailboxesAction(form);
      setMessage({
        text: result.ok ? "Public contact mailboxes saved." : result.error,
        ok: result.ok,
      });
    });
  }

  return (
    <section className="overflow-hidden rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
      <div className="border-b border-[var(--nexo-border)] bg-[var(--nexo-elevated)]/45 px-5 py-4">
        <h2 className="text-h4">Public contact mailboxes</h2>
        <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
          These are public website addresses. Personal Gmail/Yahoo-style addresses are rejected.
          Outbound SMTP credentials remain in server secrets and are not changed here.
        </p>
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-2">
        {([
          ["contactEmail", "General contact", "General public website contact."],
          ["supportEmail", "Support", "Artist and label support mailbox."],
          ["dmcaEmail", "DMCA notices", "Copyright/DMCA submission mailbox."],
          ["inquiriesEmail", "General inquiries", "Partnership and general inquiry mailbox."],
        ] as const).map(([key, label, help]) => (
          <label key={key} className="text-caption">
            <span className="font-medium text-[var(--nexo-text)]">{label}</span>
            <span className="mt-0.5 block text-[var(--nexo-text-muted)]">{help}</span>
            <Input
              type="email"
              className="mt-2"
              value={form[key]}
              onChange={(e) => setForm((current) => ({ ...current, [key]: e.target.value }))}
              autoComplete="off"
            />
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--nexo-border)] px-5 py-4">
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save public mailboxes"}
        </Button>
        {message ? (
          <span
            className={
              message.ok
                ? "text-caption text-[var(--nexo-success)]"
                : "text-caption text-[var(--nexo-error)]"
            }
          >
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
      credentials stay in server environment/secret storage. This page only controls non-secret
      operational and public website settings.
    </Alert>
  );
}
