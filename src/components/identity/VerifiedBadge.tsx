import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerifiedBadge({
  className,
  label = "Identity verified",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black text-white ring-1 ring-black/20 dark:bg-white dark:text-black dark:ring-white/20",
        className
      )}
    >
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
}
