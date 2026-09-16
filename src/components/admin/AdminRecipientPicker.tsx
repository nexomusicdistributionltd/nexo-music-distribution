"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { parseAddressList } from "@/lib/email/addresses";
import type { DirectoryKind, DirectoryRecipient } from "@/lib/email/directory";

const FILTERS: Array<{ id: "all" | DirectoryKind; label: string }> = [
  { id: "all", label: "All" },
  { id: "artist", label: "Artists" },
  { id: "label", label: "Labels" },
  { id: "user", label: "All users" },
];

function kindLabel(kind: DirectoryKind): string {
  if (kind === "artist") return "Artist";
  if (kind === "label") return "Label";
  return "User";
}

export function AdminRecipientPicker({
  directory,
  selectedKeys,
  onSelectedKeysChange,
  customEmails,
  onCustomEmailsChange,
  selectAllKind,
  onSelectAllKindChange,
  disabled,
  mode = "select",
  onAppendEmails,
}: {
  directory: DirectoryRecipient[];
  selectedKeys: string[];
  onSelectedKeysChange: (keys: string[]) => void;
  customEmails: string[];
  onCustomEmailsChange: (emails: string[]) => void;
  selectAllKind?: "all" | DirectoryKind | null;
  onSelectAllKindChange?: (kind: "all" | DirectoryKind | null) => void;
  disabled?: boolean;
  mode?: "select" | "append";
  onAppendEmails?: (emails: string[], target: "to" | "cc" | "bcc") => void;
}) {
  const [filter, setFilter] = React.useState<"all" | DirectoryKind>("all");
  const [q, setQ] = React.useState("");
  const [draft, setDraft] = React.useState("");
  const [appendTarget, setAppendTarget] = React.useState<"to" | "cc" | "bcc">("to");
  const selected = React.useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return directory.filter((row) => {
      if (filter !== "all" && row.kind !== filter) return false;
      if (!needle) return true;
      return (
        row.label.toLowerCase().includes(needle) ||
        (row.email ?? "").toLowerCase().includes(needle)
      );
    });
  }, [directory, filter, q]);

  const selectable = filtered.filter((row) => Boolean(row.email));
  const selectAllActive = Boolean(selectAllKind);

  function toggle(key: string) {
    onSelectAllKindChange?.(null);
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectedKeysChange([...next]);
  }

  function toggleVisible() {
    onSelectAllKindChange?.(null);
    const next = new Set(selected);
    const allOn = selectable.length > 0 && selectable.every((row) => next.has(row.key));
    if (allOn) {
      for (const row of selectable) next.delete(row.key);
    } else {
      for (const row of selectable) next.add(row.key);
    }
    onSelectedKeysChange([...next]);
  }

  function addCustom() {
    const emails = parseAddressList(draft);
    if (emails.length === 0) return;
    if (mode === "append" && onAppendEmails) {
      onAppendEmails(emails, appendTarget);
    } else {
      onCustomEmailsChange([...new Set([...customEmails, ...emails])]);
    }
    setDraft("");
  }

  function appendDirectory(row: DirectoryRecipient) {
    if (!row.email || !onAppendEmails) return;
    onAppendEmails([row.email], appendTarget);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={disabled}
            onClick={() => {
              setFilter(item.id);
              onSelectAllKindChange?.(null);
            }}
            className={`rounded-full border px-3 py-1 text-caption ${
              filter === item.id
                ? "border-[var(--nexo-text)] bg-[var(--nexo-elevated)]"
                : "border-[var(--nexo-border)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {mode === "select" ? (
          <label className="inline-flex items-center gap-2 text-small">
            <input
              type="checkbox"
              checked={selectAllActive}
              disabled={disabled}
              onChange={(e) => {
                onSelectAllKindChange?.(e.target.checked ? filter : null);
                if (e.target.checked) onSelectedKeysChange([]);
              }}
            />
            Select all{" "}
            {filter === "all"
              ? "loaded artists, labels, and users"
              : FILTERS.find((f) => f.id === filter)?.label.toLowerCase()}
          </label>
        ) : (
          <label className="inline-flex items-center gap-2 text-small">
            <span className="text-[var(--nexo-text-muted)]">Add to</span>
            <Select
              value={appendTarget}
              onChange={(e) => setAppendTarget(e.target.value as typeof appendTarget)}
              disabled={disabled}
              aria-label="Add recipients to"
              className="w-28"
            >
              <option value="to">To</option>
              <option value="cc">CC</option>
              <option value="bcc">BCC</option>
            </Select>
          </label>
        )}
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search artists, labels, or users"
          className="sm:max-w-xs"
          disabled={disabled || selectAllActive}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="Type any email and press Add"
          disabled={disabled}
          aria-label="Custom email"
        />
        <Button type="button" variant="outline" onClick={addCustom} disabled={disabled}>
          Add email
        </Button>
        {mode === "select" ? (
          <Button type="button" variant="ghost" onClick={toggleVisible} disabled={disabled || selectAllActive}>
            Toggle visible
          </Button>
        ) : null}
      </div>

      {mode === "select" && customEmails.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {customEmails.map((email) => (
            <li
              key={email}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--nexo-border)] px-3 py-1 text-caption"
            >
              {email}
              <button
                type="button"
                className="text-[var(--nexo-text-muted)]"
                aria-label={`Remove ${email}`}
                onClick={() => onCustomEmailsChange(customEmails.filter((item) => item !== email))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="overflow-hidden rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
        <div className="border-b border-[var(--nexo-border)] bg-[var(--nexo-surface)] px-3 py-2">
          <p className="text-caption text-[var(--nexo-text-muted)]">
            Pick any artist or label, or type an address. Directory emails resolve from the database;
            typed addresses are sent as entered.
          </p>
        </div>
        <ul className="max-h-80 divide-y divide-[var(--nexo-border)] overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-3 py-4 text-small text-[var(--nexo-text-muted)]">
              No matching artists, labels, or users.
            </li>
          ) : (
            filtered.map((row) => {
              const checked = selectAllActive || selected.has(row.key);
              const canUse = Boolean(row.email);
              return (
                <li key={row.key} className="flex items-center gap-3 px-3 py-2 text-small">
                  {mode === "select" ? (
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled || selectAllActive || !canUse}
                      onChange={() => toggle(row.key)}
                      aria-label={row.email || row.label}
                    />
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={disabled || !canUse}
                      onClick={() => appendDirectory(row)}
                    >
                      Add
                    </Button>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{row.label}</span>
                    <span className="block truncate text-caption text-[var(--nexo-text-muted)]">
                      {row.email || "No email on file"}
                    </span>
                  </span>
                  <span className="text-caption text-[var(--nexo-text-muted)]">{kindLabel(row.kind)}</span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
