"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { sendEmailTemplateAction } from "@/app/admin/emails/actions";

export type SendableUser = {
  id: string;
  email: string;
  label: string;
};

export type SendableTemplate = {
  key: string;
  name: string;
  category: string;
  subject: string;
};

export function EmailSendComposer({
  templates,
  users,
  userCount,
  defaultTemplateKey,
  providerMessage,
  providerConfigured,
}: {
  templates: SendableTemplate[];
  users: SendableUser[];
  userCount: number;
  defaultTemplateKey?: string;
  providerMessage: string;
  providerConfigured: boolean;
}) {
  const [templateKey, setTemplateKey] = React.useState(
    defaultTemplateKey && templates.some((t) => t.key === defaultTemplateKey)
      ? defaultTemplateKey
      : templates[0]?.key ?? ""
  );
  const [q, setQ] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(needle) ||
        u.label.toLowerCase().includes(needle)
    );
  }, [q, users]);

  const recipientCount = selectAll ? userCount : selected.size;

  function toggle(id: string) {
    setSelectAll(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleVisible() {
    setSelectAll(false);
    setSelected((prev) => {
      const next = new Set(prev);
      const allVisibleSelected = filtered.every((u) => next.has(u.id));
      if (allVisibleSelected) {
        for (const u of filtered) next.delete(u.id);
      } else {
        for (const u of filtered) next.add(u.id);
      }
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <Alert variant={providerConfigured ? "success" : "warning"} title="Provider">
        {providerMessage}
      </Alert>
      {templates.length === 0 ? (
        <Alert variant="warning" title="No stored templates">
          Open Templates and seed from the catalog before sending.
        </Alert>
      ) : (
        <label className="block max-w-xl space-y-1 text-small">
          <span className="text-[var(--nexo-text-muted)]">Template</span>
          <Select
            value={templateKey}
            onChange={(e) => setTemplateKey(e.target.value)}
            aria-label="Template"
          >
            {templates.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name} ({t.key})
              </option>
            ))}
          </Select>
        </label>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex items-center gap-2 text-small">
          <input
            type="checkbox"
            checked={selectAll}
            onChange={(e) => {
              setSelectAll(e.target.checked);
              if (e.target.checked) setSelected(new Set());
            }}
          />
          Select all users ({userCount} profiles with email)
        </label>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter loaded users"
          className="sm:max-w-xs"
          disabled={selectAll}
        />
      </div>

      <div className="overflow-hidden rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
        <div className="flex items-center justify-between border-b border-[var(--nexo-border)] bg-[var(--nexo-surface)] px-3 py-2">
          <p className="text-caption text-[var(--nexo-text-muted)]">
            Recipients resolve from profiles in the database — browser-typed emails are ignored.
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={toggleVisible} disabled={selectAll}>
            Toggle visible
          </Button>
        </div>
        <ul className="max-h-80 divide-y divide-[var(--nexo-border)] overflow-y-auto">
          {filtered.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-3 py-2 text-small">
              <input
                type="checkbox"
                checked={selectAll || selected.has(u.id)}
                disabled={selectAll}
                onChange={() => toggle(u.id)}
                aria-label={u.email}
              />
              <span className="min-w-0">
                <span className="block truncate font-medium">{u.label}</span>
                <span className="block truncate text-caption text-[var(--nexo-text-muted)]">
                  {u.email}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {error ? (
        <Alert variant="warning" title="Send not completed">
          {error}
        </Alert>
      ) : null}
      {result ? (
        <Alert variant={providerConfigured ? "default" : "warning"} title="Enqueue result">
          {result}
        </Alert>
      ) : null}

      <Button
        type="button"
        disabled={pending || !templateKey || recipientCount === 0}
        onClick={() => setConfirmOpen(true)}
      >
        Review and enqueue ({recipientCount})
      </Button>

      <ConfirmationDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Enqueue branded email?"
        description={
          selectAll
            ? `This will enqueue “${templateKey}” to all ${userCount} profile emails from the database. Status stays pending or unavailable until a real provider accepts the send.`
            : `This will enqueue “${templateKey}” to ${selected.size} selected user(s). Addresses come from profiles, not from the form. Status stays pending or unavailable until a real provider accepts the send.`
        }
        confirmLabel={pending ? "Enqueueing…" : "Confirm enqueue"}
        confirmDisabled={pending}
        onConfirm={() => {
          setPending(true);
          setError(null);
          setResult(null);
          void sendEmailTemplateAction({
            templateKey,
            selectAll,
            userIds: [...selected],
            confirmed: true,
          }).then((res) => {
            setPending(false);
            setConfirmOpen(false);
            if (!res.ok) setError(res.error);
            else setResult(res.data.message);
          });
        }}
      />
    </div>
  );
}
