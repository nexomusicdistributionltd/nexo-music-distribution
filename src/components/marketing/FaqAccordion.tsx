"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type FaqItem = { question: string; answer: string };

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = React.useState<number | null>(0);

  return (
    <div>
      {items.map((item, index) => {
        const isOpen = open === index;
        const panelId = `faq-panel-${index}`;
        const buttonId = `faq-button-${index}`;
        return (
          <div key={item.question} className="pub-faq-item" data-open={isOpen}>
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="pub-faq-btn"
                onClick={() => setOpen(isOpen ? null : index)}
              >
                {item.question}
                <span className="pub-faq-icon" aria-hidden>
                  {isOpen ? "×" : "+"}
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className={cn("pub-faq-panel", !isOpen && "hidden")}
            >
              {item.answer}
            </div>
          </div>
        );
      })}
    </div>
  );
}
