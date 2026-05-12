import { cn } from "@/utils/cn";
import {
  ORDER_STATUS_LABEL,
  ORDER_STATUS_COLOR,
  SEND_STATUS_LABEL,
  SEND_STATUS_COLOR,
  CHANNEL_LABEL,
  CHANNEL_COLOR,
  PRODUCT_KIND_LABEL,
  PRODUCT_KIND_COLOR,
  INQUIRY_STATUS_LABEL,
  INQUIRY_STATUS_COLOR,
  INQUIRY_TYPE_LABEL,
  INQUIRY_TYPE_COLOR,
  ADMIN_ROLE_LABEL,
  ADMIN_ROLE_COLOR,
} from "@/utils/constants";

type BadgeType =
  | "order_status"
  | "send_status"
  | "channel"
  | "product_kind"
  | "inquiry_status"
  | "inquiry_type"
  | "admin_role";

interface StatusBadgeProps {
  type: BadgeType;
  value: string;
  className?: string;
}

const LABEL_MAP: Record<BadgeType, Record<string, string>> = {
  order_status: ORDER_STATUS_LABEL,
  send_status: SEND_STATUS_LABEL,
  channel: CHANNEL_LABEL,
  product_kind: PRODUCT_KIND_LABEL,
  inquiry_status: INQUIRY_STATUS_LABEL,
  inquiry_type: INQUIRY_TYPE_LABEL,
  admin_role: ADMIN_ROLE_LABEL,
};

const COLOR_MAP: Record<BadgeType, Record<string, string>> = {
  order_status: ORDER_STATUS_COLOR,
  send_status: SEND_STATUS_COLOR,
  channel: CHANNEL_COLOR,
  product_kind: PRODUCT_KIND_COLOR,
  inquiry_status: INQUIRY_STATUS_COLOR,
  inquiry_type: INQUIRY_TYPE_COLOR,
  admin_role: ADMIN_ROLE_COLOR,
};

export function StatusBadge({ type, value, className }: StatusBadgeProps) {
  const label = LABEL_MAP[type]?.[value] ?? value;
  const color = COLOR_MAP[type]?.[value] ?? "bg-gray-100 text-gray-600";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium",
        color,
        className
      )}
    >
      {label}
    </span>
  );
}
