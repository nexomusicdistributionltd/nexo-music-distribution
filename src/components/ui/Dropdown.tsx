"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Dropdown({
  trigger,
  children,
  align = "end",
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-50 mt-2 min-w-[180px] rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-[var(--nexo-modal-bg)] p-1 shadow-[var(--nexo-shadow)] animate-rise",
            align === "end" ? "right-0" : "left-0"
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function DropdownItem({
  className,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "flex w-full items-center rounded-[var(--nexo-radius-sm)] px-3 py-2 text-left text-small text-[var(--nexo-text-secondary)] hover:bg-[var(--nexo-ghost-hover)] hover:text-[var(--nexo-text)] disabled:opacity-50",
        className
      )}
      disabled={disabled}
      {...props}
    />
  );
}
