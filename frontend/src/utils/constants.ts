// 메뉴 구조
import {
  Grid,
  Users,
  ExternalLink,
  Package,
  ShoppingCart,
  Truck,
  MessageSquare,
  Settings,
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
    icon: Grid,
    title: "대시보드",
    key: "dashboard",
    subItems: [
      { label: "오늘 주문 요약", key: "order-summary" },
      { label: "발송 대기 / 배송 중", key: "shipping" },
      { label: "신규 고객 수", key: "new-customers" },
      { label: "오류/예외 주문 알림", key: "error-orders" },
    ],
  },
  {
    icon: Users,
    title: "고객 관리",
    key: "customer",
    subItems: [
      { label: "고객 목록", key: "list" },
      {
        label: "고객 상세",
        key: "detail",
        subSubItems: [
          { label: "기본 정보", key: "detail-info", isSubSub: true },
          { label: "주문 이력", key: "detail-orders", isSubSub: true },
          { label: "상담 이력", key: "detail-counseling", isSubSub: true },
        ],
      },
    ],
  },
  {
    icon: Package,
    title: "상품 관리",
    key: "product",
    subItems: [
      { label: "상품 목록", key: "list" },
      { label: "상품 등록/수정", key: "register" },
      { label: "구성 상품 관리", key: "bundle" },
    ],
  },
  {
    icon: ShoppingCart,
    title: "주문 관리",
    key: "order",
    subItems: [
      { label: "주문 목록", key: "list" },
      { label: "예외 주문", key: "exception" },
    ],
  },
  {
    icon: Truck,
    title: "발송/배송 관리",
    key: "delivery",
    subItems: [
      { label: "발송 대기 목록", key: "pending" },
      { label: "배송 현황", key: "status" },
    ],
  },
  {
    icon: MessageSquare,
    title: "상담/채널톡",
    key: "chat",
    subItems: [
      { label: "상담 목록", key: "list" },
      { label: "고객별 상담 내역", key: "history" },
    ],
  },
  {
    icon: ExternalLink,
    title: "외부 연동 관리",
    key: "integration",
    subItems: [
      { label: "CAFE24 설정", key: "cafe24" },
      { label: "GPmall 설정", key: "gpmall" },
      { label: "연동 상태 요약", key: "status" },
    ],
  },
  {
    icon: Settings,
    title: "시스템 관리",
    key: "system",
    subItems: [
      { label: "관리자 계정 관리", key: "admin" },
      { label: "권한 관리", key: "permission" },
      { label: "기본 환경 설정", key: "settings" },
    ],
  },
];

export const MENU_TITLES: Record<string, string> = {
  dashboard: "대시보드",
  customer: "고객 관리",
  product: "상품 관리",
  order: "주문 관리",
  delivery: "발송/배송 관리",
  chat: "상담/채널톡",
  integration: "외부 연동 관리",
  system: "시스템 관리",
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
