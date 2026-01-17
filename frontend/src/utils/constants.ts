// 메뉴 구조
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  RefreshCw,
  Truck,
  HeadphonesIcon,
  Settings,
  BarChart3,
  LucideIcon,
} from "lucide-react";
import { AdminRole } from "../api/adminApi";

// 타입 정의
interface SubSubItem {
  label: string;
  key: string;
  isSubSub?: boolean;
}

interface SubItem {
  label: string;
  key: string;
  subSubItems?: SubSubItem[];
  isSubSub?: boolean;
}

interface MenuItem {
  icon: LucideIcon;
  title: string;
  key: string;
  subItems?: SubItem[];
}

interface RoleConfigItem {
  label: string;
  color: string;
}

interface AdminRoleOption {
  value: AdminRole;
  label: string;
}

export const MENU_STRUCTURE: MenuItem[] = [
  {
    icon: LayoutDashboard,
    title: "대시보드",
    key: "dashboard",
    subItems: [],
  },
  {
    icon: Users,
    title: "고객 관리",
    key: "customer",
    subItems: [
      { label: "고객 목록", key: "list" },
      { label: "고객 등록", key: "register" },
    ],
  },
  {
    icon: RefreshCw,
    title: "구독 관리",
    key: "subscription",
    subItems: [
      { label: "구독 목록", key: "list" },
      { label: "휴지 관리", key: "pause" },
      { label: "중복 구독", key: "duplicate" },
      { label: "구독 등록", key: "register" },
    ],
  },
  {
    icon: Package,
    title: "상품 관리",
    key: "product",
    subItems: [
      { label: "상품 목록", key: "list" },
      { label: "상품 등록", key: "register" },
    ],
  },
  {
    icon: ShoppingCart,
    title: "주문 관리",
    key: "order",
    subItems: [
      { label: "주문 목록", key: "list" },
      { label: "주문 등록", key: "register" },
    ],
  },
  {
    icon: Truck,
    title: "발송 관리",
    key: "shipping",
    subItems: [
      { label: "오늘택배", key: "today-courier" },
      { label: "택배발송현황", key: "courier-status" },
    ],
  },
  {
    icon: HeadphonesIcon,
    title: "고객 지원",
    key: "support",
    subItems: [
      { label: "문의 목록", key: "list" },
      { label: "문자 템플릿", key: "message-template" },
    ],
  },
  {
    icon: Settings,
    title: "설정",
    key: "settings",
    subItems: [
      { label: "관리자 설정", key: "admin" },
      { label: "Cafe24 연동", key: "cafe24" },
      { label: "마이페이지", key: "profile" },
    ],
  },
  {
    icon: BarChart3,
    title: "통계",
    key: "statistics",
    subItems: [
      { label: "매출/주문 통계", key: "sales" },
      { label: "상품별 통계", key: "product" },
      { label: "구독 통계", key: "subscription" },
      { label: "발송 통계", key: "shipping" },
    ],
  },
];

export const MENU_TITLES: Record<string, string> = {
  dashboard: "대시보드",
  customer: "고객 관리",
  product: "상품 관리",
  order: "주문 관리",
  subscription: "구독 관리",
  shipping: "발송 관리",
  support: "고객 지원",
  settings: "설정",
  statistics: "통계",
};

export const ROLE_CONFIG: Record<string, RoleConfigItem> = {
  SUPER_ADMIN: { label: "최고 관리자", color: "bg-red-100 text-red-700" },
  ADMIN: { label: "관리자", color: "bg-blue-100 text-blue-700" },
  MANAGER: { label: "매니저", color: "bg-gray-100 text-gray-700" },
};

export const ADMIN_ROLES: AdminRoleOption[] = [
  { value: AdminRole.MANAGER, label: "매니저" },
  { value: AdminRole.ADMIN, label: "관리자" },
  { value: AdminRole.SUPER_ADMIN, label: "최고 관리자" },
];

// Order Channel 상수
export enum OrderChannel {
  CAFE24 = "CAFE24",
  GPMALL = "GPMALL",
  OFFLINE = "OFFLINE",
}

export const ORDER_CHANNEL_LABELS: Record<OrderChannel, string> = {
  [OrderChannel.CAFE24]: "Cafe24",
  [OrderChannel.GPMALL]: "갓피플몰",
  [OrderChannel.OFFLINE]: "오프라인",
};

// Order Status 상수
export enum OrderStatus {
  ORDERED = "ORDERED",
  PAID = "PAID",
  CANCELLED = "CANCELLED",
  SHIPPING = "SHIPPING",
  COMPLETED = "COMPLETED",
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.ORDERED]: "주문됨",
  [OrderStatus.PAID]: "결제완료",
  [OrderStatus.CANCELLED]: "취소됨",
  [OrderStatus.SHIPPING]: "배송중",
  [OrderStatus.COMPLETED]: "완료",
};

// Product Kind 상수
export enum ProductKind {
  YEARLY = "YEARLY",
  MONTHLY = "MONTHLY",
  SINGLE = "SINGLE",
}

export const PRODUCT_KIND_LABELS: Record<ProductKind, string> = {
  [ProductKind.YEARLY]: "연간 구독",
  [ProductKind.MONTHLY]: "월간 구독",
  [ProductKind.SINGLE]: "단품",
};

// Send Status 상수
export enum SendStatus {
  PREPARING = "PREPARING",
  SHIPPED = "SHIPPED",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
}

export const SEND_STATUS_LABELS: Record<SendStatus, string> = {
  [SendStatus.PREPARING]: "발송 준비",
  [SendStatus.SHIPPED]: "발송됨",
  [SendStatus.DELIVERED]: "배송 완료",
  [SendStatus.CANCELLED]: "취소됨",
};

// Courier Company 상수
export enum CourierCompany {
  CJ = "CJ대한통운",
  LOGEN = "로젠택배",
  POST = "우체국택배",
  HANJIN = "한진택배",
  LOTTE = "롯데택배",
}

export const COURIER_COMPANY_OPTIONS = [
  CourierCompany.CJ,
  CourierCompany.LOGEN,
  CourierCompany.POST,
  CourierCompany.HANJIN,
  CourierCompany.LOTTE,
];

// Customer Channel 상수
export const CUSTOMER_CHANNEL_OPTIONS = ["CAFE24", "GPMALL", "OFFLINE", "기타"];

export const CUSTOMER_CHANNEL_LABELS: Record<string, string> = {
  CAFE24: "Cafe24",
  GPMALL: "갓피플몰",
  OFFLINE: "오프라인",
  기타: "기타",
};
