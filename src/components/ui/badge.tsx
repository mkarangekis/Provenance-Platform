import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border border-transparent px-2.5 py-1 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-surface text-text-primary border border-border-muted",
        primary: "bg-primary-500/15 text-primary-200 border border-primary-500/30",
        success: "bg-emerald-500/15 text-emerald-200 border border-emerald-400/30",
        warning: "bg-amber-500/15 text-amber-200 border border-amber-400/30",
        danger: "bg-rose-500/15 text-rose-200 border border-rose-400/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
