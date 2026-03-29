import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-gray-100 text-gray-700",
        blue: "bg-blue-50 text-blue-700",
        green: "bg-green-50 text-green-700",
        red: "bg-red-50 text-red-700",
        amber: "bg-amber-50 text-amber-700",
        purple: "bg-purple-50 text-purple-700",
        sky: "bg-sky-50 text-sky-700",
        emerald: "bg-emerald-50 text-emerald-700",
        indigo: "bg-indigo-50 text-indigo-700",
        yellow: "bg-yellow-50 text-yellow-700",
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
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
