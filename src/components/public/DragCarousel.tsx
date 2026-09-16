"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export type DragCard = {
  src: string;
  index: string;
  kicker: string;
  title: string;
  body: string;
  alt: string;
};

export function DragCarousel({ cards }: { cards: DragCard[] }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef({ active: false, startX: 0, scroll: 0 });
  const [dragging, setDragging] = React.useState(false);

  const onPointerDown = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    drag.current = { active: true, startX: e.clientX, scroll: el.scrollLeft };
    setDragging(true);
    el.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || !drag.current.active) return;
    el.scrollLeft = drag.current.scroll - (e.clientX - drag.current.startX);
  };

  const end = (e: React.PointerEvent) => {
    const el = ref.current;
    drag.current.active = false;
    setDragging(false);
    if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  };

  return (
    <div>
      <div
        ref={ref}
        className={cn("pub-drag", dragging && "is-dragging")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        role="list"
        aria-label="Capabilities. Drag to explore."
      >
        {cards.map((card) => (
          <article key={card.title} className="pub-drag-card" role="listitem">
            <Image
              src={card.src}
              alt={card.alt}
              fill
              sizes="(max-width: 768px) 78vw, 360px"
              className="object-cover"
              draggable={false}
            />
            <span className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-white/30 text-[0.65rem] tracking-widest text-white">
              {card.index}
            </span>
            <div className="pub-drag-meta">
              <p className="pub-kicker" style={{ color: "inherit", opacity: 0.75 }}>
                {card.kicker}
              </p>
              <h3 className="mt-1 font-[family-name:var(--pub-display)] text-[clamp(1.4rem,3vw,2.1rem)] uppercase leading-[0.9] tracking-[-0.02em]">
                {card.title}
              </h3>
              <p className="mt-2 text-sm opacity-80">{card.body}</p>
            </div>
          </article>
        ))}
      </div>
      <p className="pub-kicker mt-4 text-right">Drag to explore →</p>
    </div>
  );
}
