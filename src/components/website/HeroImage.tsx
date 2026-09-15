"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  HOMEPAGE_IMAGE_PRESETS,
  isLocalHomepageImage,
  resolveHomepageImage,
  type HomepageImagePreset,
} from "@/lib/website/homepage-images";

export function HeroImage({
  src,
  preset = "singer",
  alt = "",
  className,
  priority = true,
  aspectClassName = "aspect-[16/10]",
}: {
  /** CMS or resolved URL; empty → local preset */
  src?: string | null;
  preset?: HomepageImagePreset;
  alt?: string;
  className?: string;
  priority?: boolean;
  aspectClassName?: string;
}) {
  const fallback = HOMEPAGE_IMAGE_PRESETS[preset];
  const resolved = resolveHomepageImage(src, preset);
  const [current, setCurrent] = React.useState(resolved);

  React.useEffect(() => {
    setCurrent(resolveHomepageImage(src, preset));
  }, [src, preset]);

  const remote = !isLocalHomepageImage(current);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.35rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] shadow-[var(--nexo-shadow)]",
        aspectClassName,
        className
      )}
    >
      <Image
        src={current}
        alt={alt}
        fill
        sizes="(max-width: 1024px) 100vw, 40vw"
        className="object-cover"
        priority={priority}
        unoptimized={remote}
        onError={() => {
          if (current !== fallback) setCurrent(fallback);
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"
        aria-hidden
      />
    </div>
  );
}
