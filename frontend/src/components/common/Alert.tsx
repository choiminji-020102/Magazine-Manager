import React from "react";
import {
  AlertCircle,
  CheckCircle,
  Info,
  XCircle,
  LucideIcon,
} from "lucide-react";

import { cn } from "../../utils/cn";

type AlertType = "error" | "success" | "info" | "warning";

interface AlertConfig {
  icon: LucideIcon;
  bg: string;
  border: string;
  text: string;
  iconColor: string;
}

interface AlertProps {
  type?: AlertType;
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

const Alert: React.FC<AlertProps> = ({
  type = "error",
  children,
  className,
  onClose,
}) => {
  const config: Record<AlertType, AlertConfig> = {
    error: {
      icon: AlertCircle,
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
      iconColor: "text-red-500",
    },
    success: {
      icon: CheckCircle,
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-700",
      iconColor: "text-green-500",
    },
    info: {
      icon: Info,
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
      iconColor: "text-blue-500",
    },
    warning: {
      icon: XCircle,
      bg: "bg-yellow-50",
      border: "border-yellow-200",
      text: "text-yellow-700",
      iconColor: "text-yellow-500",
    },
  };

  const { icon: Icon, bg, border, text, iconColor } = config[type];

  return (
    <div
      className={cn(
        "p-3 rounded-lg flex items-start space-x-2 border",
        bg,
        border,
        text,
        className
      )}
      role="alert"
    >
      <Icon className={cn("w-5 h-5 flex-shrink-0 mt-0.5", iconColor)} />
      <div className="flex-1 text-sm">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600"
          aria-label="닫기"
        >
          <XCircle className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default Alert;
