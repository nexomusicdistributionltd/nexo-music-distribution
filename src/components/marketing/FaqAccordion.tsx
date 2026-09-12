"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type FaqItem = { question: string; answer: string };

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = React.useState<number | null>(0);

  return (
    <div className="divide-y divide-[var(--nexo-divider)] rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)]">
      {items.map((item, index) => {
        const isOpen = open === index;
        const panelId = `faq-panel-${index}`;
        const buttonId = `faq-button-${index}`;
        return (
          <div key={item.question}>
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-h4 text-[var(--nexo-text)] transition-colors hover:bg-[var(--nexo-ghost-hover)]"
                onClick={() => setOpen(isOpen ? null : index)}
              >
                {item.question}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-[var(--nexo-text-muted)] transition-transform duration-[var(--nexo-duration)]",
                    isOpen && "rotate-180"
                  )}
                  aria-hidden
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className="px-5 pb-4 text-small text-[var(--nexo-text-muted)]"
            >
              {item.answer}
            </div>
          </div>
        );
      })}
    </div>
  );
}
