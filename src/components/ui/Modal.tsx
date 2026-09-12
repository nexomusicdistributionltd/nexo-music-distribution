"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog backdrop"
        className="absolute inset-0 bg-[var(--nexo-overlay)]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 w-full max-w-lg animate-rise rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-modal-bg)] shadow-[var(--nexo-shadow-lg)]",
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--nexo-divider)] px-5 py-4">
          {title ? <h2 className="text-h4">{title}</h2> : <span />}
          <button
            type="button"
            aria-label="Close"
            className="rounded p-1 text-[var(--nexo-text-muted)] hover:bg-[var(--nexo-ghost-hover)] hover:text-[var(--nexo-text)]"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
