import Image from "next/image";
import { cn } from "@/lib/utils";

const PRESETS = {
  vinyl: "/images/vinyl.jpg",
  waveform: "/images/waveform.jpg",
  console: "/images/console.jpg",
  score: "/images/score.jpg",
  studio: "/images/studio-lines.jpg",
} as const;

export function HeroImage({
  preset = "vinyl",
  alt = "",
  className,
  priority,
}: {
  preset?: keyof typeof PRESETS;
  alt?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.35rem] border border-[var(--nexo-border)] bg-[var(--nexo-card)] shadow-[var(--nexo-shadow)]",
        className
      )}
    >
      <Image
        src={PRESETS[preset]}
        alt={alt}
        width={800}
        height={600}
        className="h-full w-full object-cover"
        priority={priority}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"
        aria-hidden
      />
    </div>
  );
}
