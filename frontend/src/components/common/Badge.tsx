import React from "react";
import { cn } from "../../utils/cn";

type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "gray"
  | "cafe24"
  | "gpmall"
  | "subscription-active"
  | "subscription-pause"
  | "subscription-duplicate";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  dot = false,
  size = "md",
  className,
}) => {
  const variants: Record<BadgeVariant, string> = {
    default: "bg-neutral-100 text-neutral-600 border-neutral-200",
    primary: "bg-accent text-white border-accent",
    success: "bg-success-100 text-success-600 border-success-200",
    warning: "bg-warning-100 text-warning-600 border-warning-200",
    danger: "bg-danger-100 text-danger-600 border-danger-200",
    info: "bg-info-100 text-info-600 border-info-200",
    gray: "bg-neutral-100 text-neutral-500 border-neutral-200",
    cafe24: "bg-cafe24-100 text-cafe24-600 border-cafe24-200",
    gpmall: "bg-gpmall-100 text-gpmall-600 border-gpmall-200",
    "subscription-active": "bg-subscription-active-100 text-subscription-active-600 border-subscription-active-200",
    "subscription-pause": "bg-subscription-pause-100 text-subscription-pause-600 border-subscription-pause-200",
    "subscription-duplicate": "bg-subscription-duplicate-100 text-subscription-duplicate-600 border-subscription-duplicate-200",
  };

  const dotVariants: Record<BadgeVariant, string> = {
    default: "bg-neutral-400",
    primary: "bg-white",
    success: "bg-success-500",
    warning: "bg-warning-500",
    danger: "bg-danger-500",
    info: "bg-info-500",
    gray: "bg-neutral-400",
    cafe24: "bg-cafe24-500",
    gpmall: "bg-gpmall-500",
    "subscription-active": "bg-subscription-active-500",
    "subscription-pause": "bg-subscription-pause-500",
    "subscription-duplicate": "bg-subscription-duplicate-500",
  };

  const sizes = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium border",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full", dotVariants[variant])}
        />
      )}
      {children}
    </span>
  );
};

export default Badge;
