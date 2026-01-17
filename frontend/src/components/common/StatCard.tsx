import React from "react";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "../../utils/cn";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  subtitle?: string;
  color?: "default" | "accent" | "blue" | "neutral" | "red";
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  subtitle,
  color = "default",
  onClick,
}) => {
  const colors = {
    default: {
      bg: "bg-paper",
      icon: "text-muted",
      border: "border-line",
    },
    accent: {
      bg: "bg-paper",
      icon: "text-ink",
      border: "border-line",
    },
    blue: {
      bg: "bg-paper",
      icon: "text-blue-600",
      border: "border-line",
    },
    neutral: {
      bg: "bg-paper",
      icon: "text-neutral-600",
      border: "border-line",
    },
    red: {
      bg: "bg-paper",
      icon: "text-red-600",
      border: "border-line",
    },
  };

  return (
    <div
      className={cn(
        "bg-white rounded-[3px] p-6 border transition-all",
        colors[color].border,
        onClick && "cursor-pointer hover:shadow-sm"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted">{title}</p>
          <p className="text-3xl font-semibold text-ink mt-2">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {trend && (
            <div className="flex items-center mt-2">
              {trend.isPositive ? (
                <TrendingUp className="w-4 h-4 text-ink mr-1" />
              ) : (
                <TrendingDown className="w-4 h-4 text-muted mr-1" />
              )}
              <span
                className={cn(
                  "text-sm font-medium",
                  trend.isPositive ? "text-ink" : "text-muted"
                )}
              >
                {trend.isPositive ? "+" : ""}
                {trend.value}%
              </span>
              {trend.label && (
                <span className="text-sm text-muted ml-1">{trend.label}</span>
              )}
            </div>
          )}
          {subtitle && <p className="text-sm text-muted mt-2">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={cn("p-3 rounded-[3px]", colors[color].bg)}>
            <Icon className={cn("w-6 h-6", colors[color].icon)} />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
