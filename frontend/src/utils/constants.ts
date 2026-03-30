// ── 주문 상태 ──────────────────────────────────────────────────────────────────

export const ORDER_STATUS_LABEL: Record<string, string> = {
  ORDERED: "주문완료",
  PAID: "결제완료",
  CANCELLED: "취소",
};

export const ORDER_STATUS_COLOR: Record<string, string> = {
  ORDERED: "bg-blue-50 text-blue-700",
  PAID: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
};

// ── 발송 상태 ──────────────────────────────────────────────────────────────────

export const SEND_STATUS_LABEL: Record<string, string> = {
  PREPARING: "준비중",
  SHIPPING: "배송중",
  DELIVERED: "배송완료",
  CANCELLED: "취소",
};

export const SEND_STATUS_COLOR: Record<string, string> = {
  PREPARING: "bg-gray-100 text-gray-600",
  SHIPPING: "bg-blue-50 text-blue-700",
  DELIVERED: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
};

// ── 주문 채널 ──────────────────────────────────────────────────────────────────

export const CHANNEL_LABEL: Record<string, string> = {
  CAFE24: "Cafe24",
  GPMALL: "갓피플몰",
  OFFLINE: "오프라인",
};

export const CHANNEL_COLOR: Record<string, string> = {
  CAFE24: "bg-blue-50 text-blue-700",
  GPMALL: "bg-emerald-50 text-emerald-700",
  OFFLINE: "bg-gray-100 text-gray-600",
};

// ── 상품 종류 ──────────────────────────────────────────────────────────────────

export const PRODUCT_KIND_LABEL: Record<string, string> = {
  YEARLY: "정기구독",
  MONTHLY: "단편",
};

export const PRODUCT_KIND_COLOR: Record<string, string> = {
  YEARLY: "bg-purple-50 text-purple-700",
  MONTHLY: "bg-sky-50 text-sky-700",
};

// ── 문의 유형 ──────────────────────────────────────────────────────────────────

export const INQUIRY_TYPE_LABEL: Record<string, string> = {
  PHONE: "전화",
  EMAIL: "이메일",
  KAKAO: "카카오",
  VISIT: "방문",
  OTHER: "기타",
};

export const INQUIRY_TYPE_COLOR: Record<string, string> = {
  PHONE: "bg-blue-50 text-blue-700",
  EMAIL: "bg-indigo-50 text-indigo-700",
  KAKAO: "bg-yellow-50 text-yellow-700",
  VISIT: "bg-purple-50 text-purple-700",
  OTHER: "bg-gray-100 text-gray-600",
};

// ── 문의 상태 ──────────────────────────────────────────────────────────────────

export const INQUIRY_STATUS_LABEL: Record<string, string> = {
  RECEIVED: "접수",
  IN_PROGRESS: "처리중",
  COMPLETED: "완료",
  CANCELLED: "취소",
};

export const INQUIRY_STATUS_COLOR: Record<string, string> = {
  RECEIVED: "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  COMPLETED: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
};

// ── 관리자 역할 ────────────────────────────────────────────────────────────────

export const ADMIN_ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "슈퍼관리자",
  ADMIN: "관리자",
  MANAGER: "매니저",
};

export const ADMIN_ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN: "bg-red-50 text-red-700",
  ADMIN: "bg-blue-50 text-blue-700",
  MANAGER: "bg-gray-100 text-gray-600",
};

// ── 활동 로그 ──────────────────────────────────────────────────────────────────

export const ACTIVITY_ACTION_LABEL: Record<string, string> = {
  CREATE: "생성",
  UPDATE: "수정",
  DELETE: "삭제",
  ACTIVATE: "활성화",
  DEACTIVATE: "비활성화",
  RESTORE: "복구",
  CANCEL: "취소",
  DISPATCH: "발송처리",
  LOGIN: "로그인",
  LOGOUT: "로그아웃",
  SIGNUP: "가입",
  ANSWER: "답변",
};

export const ACTIVITY_TARGET_LABEL: Record<string, string> = {
  ACTIVITY_LOG: "활동로그",
  ADDRESS: "배송지",
  ADMIN: "관리자",
  AUTH: "인증",
  CAFE24: "Cafe24",
  CUSTOMER: "고객",
  INQUIRY: "문의",
  ORDER_ITEM: "주문품목",
  ORDER: "주문",
  PAUSE: "휴지",
  PRODUCT: "상품",
  SEND_ITEM: "발송품목",
  SEND: "발송",
  DISPATCH: "발송처리",
};

// ── 택배사 ─────────────────────────────────────────────────────────────────────

export const COURIER_LABEL: Record<string, string> = {
  "CJ대한통운": "CJ대한통운",
  자체배송: "자체배송",
};

export const COURIER_OPTIONS = ["CJ대한통운", "자체배송"];

// ── 결제 방법 ──────────────────────────────────────────────────────────────────

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CARD: "카드",
  TRANSFER: "계좌이체",
  CASH: "현금",
  DEPOSIT: "무통장입금",
};

export const PAYMENT_METHOD_OPTIONS = [
  { value: "CARD", label: "카드" },
  { value: "TRANSFER", label: "계좌이체" },
  { value: "CASH", label: "현금" },
  { value: "DEPOSIT", label: "무통장입금" },
];
