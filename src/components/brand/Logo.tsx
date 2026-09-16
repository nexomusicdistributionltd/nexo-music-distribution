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
  /** Force mark for a known background. Default follows theme (dashboards unchanged). */
  variant?: "auto" | "on-dark" | "on-light";
};

export function Logo({
  className,
  href = "/",
  priority = false,
  height = 36,
  variant = "auto",
}: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const themeDark = !mounted || resolvedTheme === "dark";
  const onDark =
    variant === "on-dark" ? true : variant === "on-light" ? false : themeDark;
  const src = onDark
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
