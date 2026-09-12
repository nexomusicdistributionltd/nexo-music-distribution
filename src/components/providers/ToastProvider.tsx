"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "warning" | "error";
};

type ToastContextValue = {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = React.useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { ...t, id }]);
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-full max-w-sm flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto animate-rise rounded-[var(--nexo-radius)] border px-4 py-3 shadow-[var(--nexo-shadow)]",
              "bg-[var(--nexo-toast-bg)] text-[var(--nexo-toast-fg)] border-[var(--nexo-border-strong)]",
              t.variant === "success" && "border-[var(--nexo-success)]",
              t.variant === "warning" && "border-[var(--nexo-warning)]",
              t.variant === "error" && "border-[var(--nexo-error)]"
            )}
            role="status"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-small font-medium">{t.title}</p>
                {t.description ? (
                  <p className="mt-1 text-caption opacity-80">{t.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                className="rounded p-0.5 opacity-70 hover:opacity-100"
                onClick={() => dismiss(t.id)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
