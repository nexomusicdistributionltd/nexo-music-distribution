"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type RevealVariant =
  | "fade-up"
  | "fade-down"
  | "fade-left"
  | "fade-right"
  | "scale-in"
  | "fade"
  | "mask";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  variant?: RevealVariant;
  delayMs?: number;
  as?: "div" | "section" | "li" | "article";
};

/**
 * Scroll-in reveal for public pages. Respects prefers-reduced-motion.
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
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce]);

  const hidden = (() => {
    switch (variant) {
      case "scale-in":
        return "opacity-0 scale-[0.97]";
      case "fade":
        return "opacity-0";
      case "fade-left":
        return "opacity-0 -translate-x-8";
      case "fade-right":
        return "opacity-0 translate-x-8";
      case "fade-down":
        return "opacity-0 -translate-y-8";
      case "mask":
        return "opacity-0 [clip-path:inset(12%_0_0_0)] translate-y-6";
      case "fade-up":
      default:
        return "opacity-0 translate-y-10";
    }
  })();

  const shown =
    variant === "mask"
      ? "translate-y-0 scale-100 opacity-100 [clip-path:inset(0)]"
      : "translate-y-0 translate-x-0 scale-100 opacity-100";

  return (
    <Tag
      // @ts-expect-error polymorphic ref
      ref={ref}
      className={cn(
        "transform-gpu will-change-transform",
        !reduce && "transition-[opacity,transform,clip-path] duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        visible ? shown : hidden,
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
  stepMs = 110,
  variant = "fade-up",
}: {
  children: React.ReactNode;
  className?: string;
  stepMs?: number;
  variant?: RevealVariant;
}) {
  const items = React.Children.toArray(children);
  return (
    <div className={className}>
      {items.map((child, i) => (
        <Reveal key={i} delayMs={i * stepMs} variant={variant}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}
