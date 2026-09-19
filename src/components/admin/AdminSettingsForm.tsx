"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { ADMIN_SETTING_KEYS, type AdminSettingKey } from "@/lib/admin/settings";
import { saveAdminSettingAction } from "@/app/admin/actions";

type SettingRow = {
  key: string;
  value: unknown;
};

const META: Record<
  AdminSettingKey,
  { label: string; description: string; group: string; placeholder: string }
> = {
  "qc.default_priority": {
    label: "Default QC priority",
    description: "Default priority applied to new quality-control work.",
    group: "Quality control",
    placeholder: '{"priority":"normal"}',
  },
  "qc.auto_claim": {
    label: "Automatic QC claiming",
    description: "Controls whether eligible QC work may be automatically claimed.",
    group: "Quality control",
    placeholder: '{"enabled":false}',
  },
  "support.sla_hours": {
    label: "Support SLA",
    description: "Target response window for support operations.",
    group: "Support & contact",
    placeholder: '{"hours":24}',
  },
  "contact.auto_assign": {
    label: "Contact auto assignment",
    description: "Controls automatic assignment of new website contact messages.",
    group: "Support & contact",
    placeholder: '{"enabled":false}',
  },
  "operations.maintenance_notice": {
    label: "Maintenance notice",
    description: "Operational maintenance notice configuration.",
    group: "Operations",
    placeholder: '{"enabled":false,"message":""}',
  },
  "reports.retention_days": {
    label: "Report retention",
    description: "Retention window for generated operational reports.",
    group: "Operations",
    placeholder: '{"days":90}',
  },
  "finance.min_payout_minor_usd": {
    label: "Minimum payout",
    description: "Minimum payout amount in USD minor units.",
    group: "Finance",
    placeholder: '{"amount":5000}',
  },
  "finance.payouts_enabled": {
    label: "Payout requests",
    description: "Master switch for payout-request availability.",
    group: "Finance",
    placeholder: '{"enabled":true}',
  },
};

function valueText(value: unknown, placeholder: string) {
  if (value === undefined || value === null) return placeholder;
  return JSON.stringify(value, null, 2);
}

export function SettingsForm({ settings = [] }: { settings?: SettingRow[] }) {
  const router = useRouter();
  const stored = React.useMemo(
    () => new Map(settings.map((row) => [row.key, row.value])),
    [settings]
  );
  const [key, setKey] = React.useState<AdminSettingKey>("qc.default_priority");
  const [value, setValue] = React.useState(() =>
    valueText(stored.get("qc.default_priority"), META["qc.default_priority"].placeholder)
  );
  const [msg, setMsg] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const meta = META[key];

  function choose(next: AdminSettingKey) {
    setKey(next);
    setValue(valueText(stored.get(next), META[next].placeholder));
    setMsg(null);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.75fr)]">
      <section className="overflow-hidden rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)]">
        <div className="border-b border-[var(--nexo-border)] px-5 py-4">
          <h2 className="text-h4">Platform configuration</h2>
          <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
            Operational controls are grouped by function. Credentials and API secrets remain server-only.
          </p>
        </div>
        <div className="grid gap-0 sm:grid-cols-2">
          {ADMIN_SETTING_KEYS.map((settingKey) => {
            const item = META[settingKey];
            const configured = stored.has(settingKey);
            return (
              <button
                key={settingKey}
                type="button"
                onClick={() => choose(settingKey)}
                className={[
                  "border-b border-[var(--nexo-border)] p-4 text-left transition-colors hover:bg-[var(--nexo-ghost-hover)] sm:border-r",
                  key === settingKey ? "bg-[var(--nexo-elevated)]" : "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">
                      {item.group}
                    </p>
                    <p className="mt-1 text-small font-semibold text-[var(--nexo-text)]">
                      {item.label}
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--nexo-border)] px-2 py-0.5 text-[10px] font-medium">
                    {configured ? "Configured" : "Default"}
                  </span>
                </div>
                <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">
                  {item.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      <form
        className="h-fit space-y-4 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setMsg(null);
          try {
            const parsed = JSON.parse(value) as Record<string, unknown>;
            if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
              setMsg("Value must be a JSON object.");
              return;
            }
            const result = await saveAdminSettingAction({ key, value: parsed });
            setMsg(result.ok ? "Setting saved." : result.error);
            if (result.ok) router.refresh();
          } catch {
            setMsg("Value must be valid JSON.");
          } finally {
            setPending(false);
          }
        }}
      >
        <div>
          <p className="text-caption uppercase tracking-wide text-[var(--nexo-text-muted)]">
            {meta.group}
          </p>
          <h2 className="mt-1 text-h4">{meta.label}</h2>
          <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">{meta.description}</p>
        </div>

        <label className="block text-caption font-medium">
          Setting
          <Select
            className="mt-1"
            value={key}
            onChange={(event) => choose(event.target.value as AdminSettingKey)}
          >
            {ADMIN_SETTING_KEYS.map((settingKey) => (
              <option key={settingKey} value={settingKey}>
                {META[settingKey].label}
              </option>
            ))}
          </Select>
        </label>

        <label className="block text-caption font-medium">
          Configuration
          <Textarea
            className="mt-1 min-h-36 font-mono text-caption"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={meta.placeholder}
            spellCheck={false}
          />
        </label>

        {msg ? <p className="text-caption text-[var(--nexo-text-muted)]">{msg}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save setting"}
        </Button>
      </form>
    </div>
  );
}
