// ── 주문 상태 ──────────────────────────────────────────────────────────────────

export const ORDER_STATUS_LABEL: Record<string, string> = {
  ORDERED: "주문완료",
  PAID: "결제완료",
  CANCELLED: "취소",
  UNPAID_CANCELLED: "미결제 취소",
};

export const ORDER_STATUS_COLOR: Record<string, string> = {
  ORDERED: "bg-blue-50 text-blue-700",
  PAID: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
  UNPAID_CANCELLED: "bg-orange-50 text-orange-700",
};

// ── 발송 상태 (SHIPPING 폐기됨, 마이그레이션 011 — 3값) ──────────────────────

export const SEND_STATUS_LABEL: Record<string, string> = {
  PREPARING: "배송준비중",
  DELIVERED: "배송완료",
  CANCELLED: "취소",
};

export const SEND_STATUS_COLOR: Record<string, string> = {
  PREPARING: "bg-gray-100 text-gray-600",
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

export const CHANNEL_OPTIONS = [
  { value: "CAFE24", label: "Cafe24" },
  { value: "GPMALL", label: "갓피플몰" },
  { value: "OFFLINE", label: "오프라인" },
];

// ── 상품 prefix ───────────────────────────────────────────────────────────────

export const PRODUCT_PREFIX_LABEL: Record<string, string> = {
  W0: "말씀함께 [기본판]",
  WB: "말씀함께 [큰글자판]",
  HN: "꿀땅 [미취학부]",
  CL: "어린이 말씀함께 [저학년 1-3학년]",
  CH: "어린이 말씀함께 [고학년 4-6학년]",
  JN: "청소년 말씀함께",
};

// ── 상품 종류 ──────────────────────────────────────────────────────────────────

export const PRODUCT_KIND_LABEL: Record<string, string> = {
  YEARLY: "정기구독",
  MONTHLY: "단품",
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
  RESEND: "재배송",
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

// ── 배송 방법 (send_method) — 4값 ─────────────────────────────────────────────

export const SEND_METHOD_LABEL: Record<string, string> = {
  기출유우편: "기출유우편",
  기출유택배: "기출유택배",
  일반우편: "일반우편",
  찾아가기: "찾아가기",
};

export const SEND_METHOD_OPTIONS = [
  { value: "기출유우편", label: "기출유우편" },
  { value: "기출유택배", label: "기출유택배" },
  { value: "일반우편", label: "일반우편" },
  { value: "찾아가기", label: "찾아가기" },
];

// ── 운송사 (courier_company) — 2값 ────────────────────────────────────────────

export const COURIER_COMPANY_LABEL: Record<string, string> = {
  CJ대한통운: "CJ대한통운",
  자체배송: "자체배송",
};

export const COURIER_COMPANY_OPTIONS = [
  { value: "CJ대한통운", label: "CJ대한통운" },
  { value: "자체배송", label: "자체배송" },
];

// send_method → courier_company 자동 도출 매핑 (운영자가 수정 가능, 완전 독립이지만 기본값 제공)
export const SEND_METHOD_TO_COURIER: Record<string, string> = {
  기출유우편: "자체배송",
  기출유택배: "CJ대한통운",
  일반우편: "자체배송",
  찾아가기: "자체배송",
};

// ── 재배송 사유 옵션 ──────────────────────────────────────────────────────────

export const RESEND_REASON_OPTIONS = [
  { value: "주소 오류", label: "주소 오류" },
  { value: "분실/파손", label: "분실/파손" },
  { value: "고객 요청", label: "고객 요청" },
  { value: "반송", label: "반송" },
  { value: "기타", label: "기타" },
];

// ── 결제 방법 ──────────────────────────────────────────────────────────────────

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash:  "무통장",
  card:  "신용카드",
  icash: "가상계좌",
  tcash: "계좌이체",
};

export const PAYMENT_METHOD_OPTIONS = [
  { value: "cash",  label: "무통장" },
  { value: "card",  label: "신용카드" },
  { value: "icash", label: "가상계좌" },
  { value: "tcash", label: "계좌이체" },
];
