import { cn } from "@/lib/utils";

export function DisplayHeading({
  as: Tag = "h2",
  size = "xl",
  className,
  children,
}: {
  as?: "h1" | "h2" | "h3" | "p";
  size?: "hero" | "xl" | "lg" | "md";
  className?: string;
  children: React.ReactNode;
}) {
  const sizeClass =
    size === "hero"
      ? "pub-display-hero"
      : size === "lg"
        ? "pub-display-lg"
        : size === "md"
          ? "pub-display-md"
          : "pub-display-xl";
  return <Tag className={cn("pub-display", sizeClass, className)}>{children}</Tag>;
}
