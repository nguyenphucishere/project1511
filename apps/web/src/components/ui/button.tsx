import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Buttons are chamfered (.bezel), so focus is drawn with an inset shadow: an outline would be clipped.
const buttonVariants = cva(
  "bezel bezel-sm inline-flex items-center justify-center gap-2 font-medium transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none disabled:pointer-events-none disabled:bg-surface/25 disabled:text-foreground/45 disabled:shadow-[inset_0_0_0_1px_rgb(var(--border)/0.15)]",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-none hover:bg-primary/85 focus-visible:shadow-[inset_0_0_0_2px_rgb(var(--space-deep)),inset_0_0_0_4px_rgb(var(--primary))]",
        secondary:
          "bg-surface/40 text-foreground hover:bg-surface/70 focus-visible:shadow-[inset_0_0_0_2px_rgb(var(--primary))]",
        ghost:
          "bg-transparent text-foreground shadow-none hover:bg-surface/40 focus-visible:shadow-[inset_0_0_0_2px_rgb(var(--primary))]",
        danger:
          "bg-warning text-space-deep shadow-none hover:bg-warning/85 focus-visible:shadow-[inset_0_0_0_2px_rgb(var(--space-deep)),inset_0_0_0_4px_rgb(var(--warning))]",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-5 text-sm",
        lg: "h-12 px-7 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? "button")}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
