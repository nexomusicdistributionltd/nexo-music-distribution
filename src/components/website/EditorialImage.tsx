"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  HOMEPAGE_IMAGE_PRESETS,
  isLocalHomepageImage,
  type HomepageImagePreset,
} from "@/lib/website/homepage-images";

export type EditorialMotion =
  | "mask-up"
  | "mask-left"
  | "scale-in"
  | "fade-parallax"
  | "clip-diagonal";

type EditorialImageProps = {
  src: string;
  fallbackPreset?: HomepageImagePreset;
  alt?: string;
  className?: string;
  frameClassName?: string;
  priority?: boolean;
  motion?: EditorialMotion;
  aspectClassName?: string;
  sizes?: string;
  hoverZoom?: boolean;
};

/**
 * Editorial homepage photo with varied reveal motion.
 * Image pixels always paint (no blank boxes). Motion is a one-shot polish on enter.
 * onError → local preset. Respects prefers-reduced-motion.
 */
export function EditorialImage({
  src,
  fallbackPreset = "vinyl",
  alt = "",
  className,
  frameClassName,
  priority = false,
  motion = "scale-in",
  aspectClassName = "aspect-[4/3]",
  sizes = "(max-width: 1024px) 100vw, 42vw",
  hoverZoom = true,
}: EditorialImageProps) {
  const fallback = HOMEPAGE_IMAGE_PRESETS[fallbackPreset];
  const [current, setCurrent] = React.useState(src || fallback);
  const [active, setActive] = React.useState(false);
  const [reduce, setReduce] = React.useState(false);
  const [parallax, setParallax] = React.useState(0);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    setCurrent(src || fallback);
  }, [src, fallback]);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  React.useEffect(() => {
    if (reduce) {
      setActive(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setActive(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -4% 0px", threshold: 0.08 }
    );
    io.observe(el);
    // Fallback: never leave motion-pending forever (e.g. odd screenshot/print paths)
    const t = window.setTimeout(() => setActive(true), 1200);
    return () => {
      io.disconnect();
      window.clearTimeout(t);
    };
  }, [reduce]);

  React.useEffect(() => {
    if (reduce || motion !== "fade-parallax") return;
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2 - window.innerHeight / 2;
      setParallax(Math.max(-12, Math.min(12, mid * -0.04)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduce, motion]);

  const motionClass = (() => {
    if (reduce) return "opacity-100 scale-100";
    if (!active) {
      switch (motion) {
        case "mask-up":
          return "opacity-100 [clip-path:inset(12%_0_0_0)] scale-[1.02]";
        case "mask-left":
          return "opacity-100 [clip-path:inset(0_18%_0_0)] scale-[1.02]";
        case "clip-diagonal":
          return "opacity-100 [clip-path:polygon(0_0,92%_0,100%_100%,0_100%)] scale-[1.02]";
        case "fade-parallax":
          return "opacity-95 translate-y-2 scale-[1.01]";
        case "scale-in":
        default:
          return "opacity-100 scale-[1.045]";
      }
    }
    switch (motion) {
      case "mask-up":
      case "mask-left":
        return "opacity-100 [clip-path:inset(0)] scale-100";
      case "clip-diagonal":
        return "opacity-100 [clip-path:polygon(0_0,100%_0,100%_100%,0_100%)] scale-100";
      case "fade-parallax":
        return "opacity-100 translate-y-0 scale-100";
      case "scale-in":
      default:
        return "opacity-100 scale-100";
    }
  })();

  const remote = !isLocalHomepageImage(current);

  return (
    <div
      ref={ref}
      className={cn(
        "group relative overflow-hidden rounded-[1.35rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] shadow-[var(--nexo-shadow)]",
        aspectClassName,
        frameClassName,
        className
      )}
    >
      <div
        className={cn(
          "absolute inset-0 transform-gpu will-change-transform",
          !reduce && "transition-[opacity,transform,clip-path] duration-1000 ease-out",
          motionClass,
          !reduce && hoverZoom && "group-hover:scale-[1.03]"
        )}
        style={
          !reduce && motion === "fade-parallax"
            ? { transform: `translate3d(0, ${parallax}px, 0) scale(1)` }
            : undefined
        }
      >
        <Image
          src={current}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
          unoptimized={remote}
          onError={() => {
            if (current !== fallback) setCurrent(fallback);
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent"
          aria-hidden
        />
      </div>
    </div>
  );
}
