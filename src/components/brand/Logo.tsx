"use client";

import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import * as React from "react";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  href?: string;
  priority?: boolean;
  /** Height in px; width scales from intrinsic ratio */
  height?: number;
};

export function Logo({
  className,
  href = "/",
  priority = false,
  height = 36,
}: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // Avoid hydration mismatch: default to dark logo until mounted
  const isDark = !mounted || resolvedTheme === "dark";
  const src = isDark
    ? "/brand/nexo-logo-dark.png"
    : "/brand/nexo-logo-light.png";

  // Intrinsic ~1140x310 → aspect ~3.68
  const width = Math.round(height * 3.68);

  const img = (
    <Image
      src={src}
      alt="NEXO Music Distribution"
      width={width}
      height={height}
      priority={priority}
      className={cn("h-auto w-auto object-contain", className)}
      style={{ height, width: "auto" }}
    />
  );

  if (!href) return img;
  return (
    <Link href={href} className="inline-flex items-center" aria-label="NEXO home">
      {img}
    </Link>
  );
}
