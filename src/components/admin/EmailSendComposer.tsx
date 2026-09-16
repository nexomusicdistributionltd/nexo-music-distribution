"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { ConfirmationDialog } from "@/components/ui/ConfirmationDialog";
import { AdminRecipientPicker } from "@/components/admin/AdminRecipientPicker";
import { sendEmailTemplateAction } from "@/app/admin/emails/actions";
import { parseDirectoryKeys, type AdminSelectAllKind } from "@/lib/email/campaign";
import type { DirectoryRecipient } from "@/lib/email/directory";

export type SendableTemplate = {
  key: string;
  name: string;
  category: string;
  subject: string;
};

export function EmailSendComposer({
  templates,
  directory,
  defaultTemplateKey,
  providerMessage,
  providerConfigured,
}: {
  templates: SendableTemplate[];
  directory: DirectoryRecipient[];
  defaultTemplateKey?: string;
  providerMessage: string;
  providerConfigured: boolean;
}) {
  const [templateKey, setTemplateKey] = React.useState(
    defaultTemplateKey && templates.some((t) => t.key === defaultTemplateKey)
      ? defaultTemplateKey
      : templates[0]?.key ?? ""
  );
  const [selectedKeys, setSelectedKeys] = React.useState<string[]>([]);
  const [customEmails, setCustomEmails] = React.useState<string[]>([]);
  const [selectAllKind, setSelectAllKind] = React.useState<AdminSelectAllKind | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<string | null>(null);

  const directoryCount = directory.filter((row) => row.email).length;
  const recipientCount = selectAllKind
    ? directory.filter((row) => (selectAllKind === "all" ? true : row.kind === selectAllKind) && row.email)
        .length
    : selectedKeys.length + customEmails.length;

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

      <AdminRecipientPicker
        directory={directory}
        selectedKeys={selectedKeys}
        onSelectedKeysChange={setSelectedKeys}
        customEmails={customEmails}
        onCustomEmailsChange={setCustomEmails}
        selectAllKind={selectAllKind}
        onSelectAllKindChange={setSelectAllKind}
        disabled={pending}
      />

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
        Review and enqueue ({recipientCount}
        {selectAllKind ? "+" : ""})
      </Button>

      <ConfirmationDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Enqueue branded email?"
        description={
          selectAllKind
            ? `This will enqueue “${templateKey}” to ${selectAllKind === "all" ? "all loaded artists, labels, and users" : `all ${selectAllKind}s`} with emails (${directoryCount} currently loaded), plus any extra typed addresses. Status stays queued or skipped until Zoho SMTP accepts the send.`
            : `This will enqueue “${templateKey}” to ${selectedKeys.length} selected artist/label/user row(s) and ${customEmails.length} typed address(es). Directory emails resolve from the database; typed addresses are used as entered. Status stays queued or skipped until a real provider accepts the send.`
        }
        confirmLabel={pending ? "Enqueueing…" : "Confirm enqueue"}
        confirmDisabled={pending}
        onConfirm={() => {
          setPending(true);
          setError(null);
          setResult(null);
          const parsed = parseDirectoryKeys(selectedKeys);
          void sendEmailTemplateAction({
            templateKey,
            selectAll: selectAllKind === "user",
            selectAllKind,
            userIds: parsed.userIds,
            artistIds: parsed.artistIds,
            labelIds: parsed.labelIds,
            customEmails,
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
