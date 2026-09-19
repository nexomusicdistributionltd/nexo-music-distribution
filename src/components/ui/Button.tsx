import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button colors use an arbitrary color property instead of a text-color utility so
 * twMerge does not strip them when text-size utilities are present.
 * (That conflict made size="sm" primary CTAs blank: bg matches inherited text.)
 */
const buttonVariants = cva(
  "inline-flex touch-manipulation select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--nexo-radius)] text-[length:0.875rem] leading-none tracking-[0.01em] font-medium transition-[background-color,color,border-color,opacity,transform] duration-[var(--nexo-duration)] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-ring)] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--nexo-primary)] [color:var(--nexo-primary-fg)] hover:bg-[var(--nexo-primary-hover)] active:bg-[var(--nexo-primary-active)]",
        secondary:
          "bg-[var(--nexo-secondary)] [color:var(--nexo-secondary-fg)] hover:bg-[var(--nexo-secondary-hover)]",
        outline:
          "border border-[var(--nexo-outline-border)] bg-transparent [color:var(--nexo-outline-fg)] hover:bg-[var(--nexo-outline-hover)]",
        ghost:
          "bg-transparent [color:var(--nexo-text-secondary)] hover:bg-[var(--nexo-ghost-hover)] hover:[color:var(--nexo-text)]",
      },
      size: {
        sm: "h-8 px-3 text-[length:0.75rem]",
        md: "h-10 px-4",
        lg: "h-11 px-5",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { buttonVariants };
