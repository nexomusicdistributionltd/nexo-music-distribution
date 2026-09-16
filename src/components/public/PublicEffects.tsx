"use client";

import * as React from "react";

/** Scroll progress bar + reduced-motion class. Marketing shell only. */
export function PublicEffects() {
  const barRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      bar.style.transform = "scaleX(0)";
      return;
    }
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      bar.style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return <div className="pub-progress" ref={barRef} aria-hidden />;
}
