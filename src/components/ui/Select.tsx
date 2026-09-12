import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-10 w-full appearance-none rounded-[var(--nexo-radius)] border border-[var(--nexo-input-border)] bg-[var(--nexo-input-bg)] px-3 text-small text-[var(--nexo-text)]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-ring)]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
