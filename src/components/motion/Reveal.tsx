"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** fade-up | scale-in | fade */
  variant?: "fade-up" | "scale-in" | "fade";
  delayMs?: number;
  as?: "div" | "section" | "li" | "article";
};

/**
 * Scroll-in reveal. Respects prefers-reduced-motion (shows immediately).
 * Uses IntersectionObserver — no layout thrash / no horizontal overflow.
 */
export function Reveal({
  children,
  className,
  variant = "fade-up",
  delayMs = 0,
  as: Tag = "div",
}: RevealProps) {
  const ref = React.useRef<HTMLElement | null>(null);
  const [visible, setVisible] = React.useState(false);
  const [reduce, setReduce] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  React.useEffect(() => {
    if (reduce) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce]);

  const hidden =
    variant === "scale-in"
      ? "opacity-0 scale-[0.98]"
      : variant === "fade"
        ? "opacity-0"
        : "opacity-0 translate-y-3";

  return (
    <Tag
      // @ts-expect-error polymorphic ref
      ref={ref}
      className={cn(
        "transform-gpu will-change-transform",
        !reduce && "transition-[opacity,transform] duration-700 ease-out",
        visible ? "translate-y-0 scale-100 opacity-100" : hidden,
        className
      )}
      style={delayMs && !reduce ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

export function Stagger({
  children,
  className,
  stepMs = 70,
}: {
  children: React.ReactNode;
  className?: string;
  stepMs?: number;
}) {
  const items = React.Children.toArray(children);
  return (
    <div className={className}>
      {items.map((child, i) => (
        <Reveal key={i} delayMs={i * stepMs}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}
