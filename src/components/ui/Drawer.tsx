"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Drawer({
  open,
  onClose,
  title,
  children,
  side = "right",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  side?: "left" | "right";
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] transition-opacity duration-[var(--nexo-duration)]",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close drawer backdrop"
        className="absolute inset-0 bg-[var(--nexo-overlay)]"
        onClick={onClose}
      />
      <aside
        className={cn(
          "absolute top-0 flex h-full w-full max-w-sm flex-col border-[var(--nexo-border)] bg-[var(--nexo-modal-bg)] shadow-[var(--nexo-shadow-lg)] transition-transform duration-[var(--nexo-duration-slow)] ease-[var(--nexo-ease)]",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
          open
            ? "translate-x-0"
            : side === "right"
              ? "translate-x-full"
              : "-translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Drawer"}
      >
        <div className="flex items-center justify-between border-b border-[var(--nexo-divider)] px-4 py-3">
          {title ? <h2 className="text-h4">{title}</h2> : <span />}
          <button
            type="button"
            aria-label="Close"
            className="rounded p-1 text-[var(--nexo-text-muted)] hover:bg-[var(--nexo-ghost-hover)]"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </div>
  );
}
