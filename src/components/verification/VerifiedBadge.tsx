import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerifiedBadge({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-black/20 bg-black font-semibold text-white shadow-sm dark:border-white/25",
        compact ? "h-5 px-1.5 text-[0.62rem]" : "h-6 px-2 text-[0.7rem]",
        className
      )}
      title="Identity verified by Nexo Music Distribution"
      aria-label="Identity verified"
    >
      <BadgeCheck className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      {compact ? null : <span>Verified</span>}
    </span>
  );
}
