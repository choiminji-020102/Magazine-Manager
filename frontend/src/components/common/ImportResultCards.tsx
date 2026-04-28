import { ReactNode } from "react";
import { XCircle, AlertTriangle, MinusCircle } from "lucide-react";

export type ImportTone = "success" | "danger" | "warning" | "neutral";

const STAT_CARD_TONE: Record<ImportTone, { border: string; bg: string; icon: string; num: string }> = {
  success: {
    border: "border-green-200",
    bg: "bg-green-50",
    icon: "text-green-600",
    num: "text-green-700",
  },
  danger: {
    border: "border-red-200",
    bg: "bg-red-50",
    icon: "text-red-600",
    num: "text-red-700",
  },
  warning: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    icon: "text-amber-600",
    num: "text-amber-700",
  },
  neutral: {
    border: "border-gray-200",
    bg: "bg-gray-50",
    icon: "text-gray-500",
    num: "text-gray-700",
  },
};

export function ImportStatCard({
  label,
  count,
  icon,
  tone,
  unit = "건",
}: {
  label: string;
  count: number;
  icon: ReactNode;
  tone: ImportTone;
  unit?: string;
}) {
  const t = STAT_CARD_TONE[tone];
  return (
    <div className={`border ${t.border} ${t.bg} rounded-lg px-4 py-3 flex items-center gap-3`}>
      <div className={t.icon}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-gray-600 font-medium tracking-tight">{label}</div>
        <div className={`text-lg font-semibold leading-tight ${t.num}`}>
          {count.toLocaleString()}
          <span className="text-xs font-normal text-gray-500 ml-0.5">{unit}</span>
        </div>
      </div>
    </div>
  );
}

const DETAIL_CARD_TONE: Record<Exclude<ImportTone, "success">, { border: string; bg: string; icon: string; msg: string }> = {
  danger: {
    border: "border-red-200",
    bg: "bg-red-50/60",
    icon: "text-red-600",
    msg: "text-red-700",
  },
  warning: {
    border: "border-amber-200",
    bg: "bg-amber-50/60",
    icon: "text-amber-600",
    msg: "text-amber-700",
  },
  neutral: {
    border: "border-gray-200",
    bg: "bg-gray-50",
    icon: "text-gray-500",
    msg: "text-gray-700",
  },
};

const DETAIL_ICON = {
  danger: XCircle,
  warning: AlertTriangle,
  neutral: MinusCircle,
};

export function ImportDetailCard({
  itemKey,
  message,
  tone,
}: {
  itemKey: string;
  message: string;
  tone: "danger" | "warning" | "neutral";
}) {
  const t = DETAIL_CARD_TONE[tone];
  const Icon = DETAIL_ICON[tone];
  return (
    <div className={`border ${t.border} ${t.bg} rounded-lg px-3 py-2`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${t.icon}`} />
        <span className="font-mono text-xs text-gray-800 font-medium">{itemKey}</span>
      </div>
      <p className={`text-xs leading-relaxed break-all pl-5 ${t.msg}`}>{message}</p>
    </div>
  );
}
