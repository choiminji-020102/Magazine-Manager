import React from "react";
import { LucideIcon } from "lucide-react";

import { cn } from "../../utils/cn";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline";
type ButtonSize = "sm" | "md" | "lg";
type IconPosition = "left" | "right";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: IconPosition;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  type = "button",
  disabled = false,
  loading = false,
  className,
  icon: Icon,
  iconPosition = "left",
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg";

  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-accent text-white hover:bg-accent-hover focus:ring-accent/30 shadow-sm hover:shadow-md",
    secondary:
      "bg-info-50 text-accent hover:bg-info-100 focus:ring-accent/20 border border-info-200",
    danger:
      "bg-danger-500 text-white hover:bg-danger-600 focus:ring-danger-500/30 shadow-sm",
    ghost:
      "bg-transparent text-muted hover:bg-paper hover:text-ink focus:ring-accent/20",
    outline:
      "bg-transparent text-ink border border-line hover:bg-paper hover:border-accent/30 focus:ring-accent/20",
  };

  const sizes: Record<ButtonSize, string> = {
    sm: "px-3 py-1.5 text-sm gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-6 py-3 text-base gap-2",
  };

  const iconSizes: Record<ButtonSize, string> = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading ? (
        <>
          <svg
            className={cn("animate-spin", iconSizes[size])}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>처리 중...</span>
        </>
      ) : (
        <>
          {Icon && iconPosition === "left" && <Icon className={iconSizes[size]} />}
          {children}
          {Icon && iconPosition === "right" && <Icon className={iconSizes[size]} />}
        </>
      )}
    </button>
  );
};

export default Button;
