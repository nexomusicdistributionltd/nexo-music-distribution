import { cn } from "@/lib/utils";

export function CoverArt({
  src,
  alt,
  title,
  size = 40,
  className,
}: {
  src?: string | null;
  alt?: string;
  title?: string;
  size?: number;
  className?: string;
}) {
  const initial = (title || alt || "N").trim().charAt(0).toUpperCase() || "N";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--nexo-radius-sm)] border border-[var(--nexo-border)] bg-[var(--nexo-elevated)] text-caption font-medium text-[var(--nexo-text-muted)]",
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden={!alt}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt || ""} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{initial}</span>
      )}
    </span>
  );
}
