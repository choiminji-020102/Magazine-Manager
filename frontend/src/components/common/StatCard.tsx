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
  color?: "default" | "accent" | "blue" | "neutral" | "red" | "green" | "purple" | "subscription-active";
  valueColor?: string; // 값의 텍스트 색상 커스터마이징
  iconColor?: string; // 아이콘 색상 커스터마이징
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  subtitle,
  color = "default",
  valueColor,
  iconColor,
  onClick,
}) => {
  const colors = {
    default: {
      icon: "text-muted",
      iconBg: "bg-chip",
    },
    accent: {
      icon: "text-accent",
      iconBg: "bg-accent-50",
    },
    blue: {
      icon: "text-blue-500",
      iconBg: "bg-blue-50",
    },
    green: {
      icon: "text-green-500",
      iconBg: "bg-green-50",
    },
    purple: {
      icon: "text-purple-500",
      iconBg: "bg-purple-50",
    },
    "subscription-active": {
      icon: "text-subscription-active-500",
      iconBg: "bg-subscription-active-50",
    },
    neutral: {
      icon: "text-neutral-500",
      iconBg: "bg-neutral-50",
    },
    red: {
      icon: "text-red-500",
      iconBg: "bg-red-50",
    },
  };

  const colorScheme = colors[color] || colors.default;
  const iconColorClass = iconColor || colorScheme.icon;
  const iconBgClass = colorScheme.iconBg;
  const valueColorClass = valueColor || "text-ink";

  return (
    <div
      className={cn(
        "px-3 py-2 flex items-center justify-between transition-all",
        onClick && "cursor-pointer hover:bg-chip/30"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {Icon && (
          <div className={cn("w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0", iconBgClass)}>
            <Icon className={cn("w-3.5 h-3.5", iconColorClass)} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted">{title}</p>
          {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <p className={cn("text-lg font-bold", valueColorClass)}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {trend && (
          <div className="flex items-center">
            {trend.isPositive ? (
              <TrendingUp className="w-3.5 h-3.5 text-success-600 mr-0.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-danger-600 mr-0.5" />
            )}
            <span
              className={cn(
                "text-xs font-medium",
                trend.isPositive ? "text-success-600" : "text-danger-600"
              )}
            >
              {trend.isPositive ? "+" : ""}
              {trend.value}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
