"use client";

import { Modal } from "./Modal";
import { Button } from "./Button";

export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  confirmDisabled = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  confirmDisabled?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {description ? (
        <p className="text-small text-[var(--nexo-text-muted)]">{description}</p>
      ) : null}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? "outline" : "primary"}
          disabled={confirmDisabled}
          onClick={onConfirm}
          className={
            destructive
              ? "border-[var(--nexo-error)] text-[var(--nexo-error)] hover:bg-[var(--nexo-error-bg)]"
              : undefined
          }
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
