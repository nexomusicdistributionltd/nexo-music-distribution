import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function IdentityVerifiedBadge({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span
      title="Identity verified by Nexo Music Distribution LTD"
      aria-label="Identity verified"
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-black px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white",
        className
      )}
    >
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
      {compact ? null : "Verified"}
    </span>
  );
}
