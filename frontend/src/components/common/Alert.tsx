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
  // Notion 스타일: 모두 통일된 회색
  const config: Record<AlertType, AlertConfig> = {
    error: {
      icon: AlertCircle,
      bg: "bg-paper",
      border: "border-line",
      text: "text-muted",
      iconColor: "text-muted",
    },
    success: {
      icon: CheckCircle,
      bg: "bg-paper",
      border: "border-line",
      text: "text-ink",
      iconColor: "text-ink",
    },
    info: {
      icon: Info,
      bg: "bg-paper",
      border: "border-line",
      text: "text-ink",
      iconColor: "text-muted",
    },
    warning: {
      icon: XCircle,
      bg: "bg-paper",
      border: "border-line",
      text: "text-muted",
      iconColor: "text-muted",
    },
  };

  const { icon: Icon, bg, border, text, iconColor } = config[type];

  return (
    <div
      className={cn(
        "p-3 rounded-[3px] flex items-start space-x-2 border",
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
          className="flex-shrink-0 text-muted hover:text-ink"
          aria-label="닫기"
        >
          <XCircle className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default Alert;
