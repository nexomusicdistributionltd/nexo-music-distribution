"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** UI-only language selector — localization not wired in Batch 1. */
export function LanguageSelector({ className }: { className?: string }) {
  return (
    <button
      type="button"
      disabled
      title="Language selection coming soon"
      aria-label="Language selector (coming soon)"
      className={cn(
        "inline-flex h-9 items-center gap-1 rounded-[var(--nexo-radius-sm)] px-2.5",
        "text-nav text-[var(--nexo-text-muted)] opacity-70 cursor-not-allowed",
        className
      )}
    >
      EN
      <ChevronDown className="h-3.5 w-3.5" />
    </button>
  );
}
