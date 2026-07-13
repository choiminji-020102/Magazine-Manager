// ── 주문 상태 ──────────────────────────────────────────────────────────────────

export const ORDER_STATUS_LABEL: Record<string, string> = {
  ORDERED: "주문완료",
  PAID: "결제완료",
  CANCELLED: "취소",
  UNPAID_CANCELLED: "미결제 취소",
  UNKNOWN: "지원 안 함",  // Cafe24 매핑 실패 시 sentinel
};

export const ORDER_STATUS_COLOR: Record<string, string> = {
  ORDERED: "bg-blue-50 text-blue-700",
  PAID: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
  UNPAID_CANCELLED: "bg-orange-50 text-orange-700",
  UNKNOWN: "bg-yellow-50 text-yellow-700",
};

// ── 발송 상태 (SHIPPING 폐기됨, 마이그레이션 011 — 3값) ──────────────────────

export const SEND_STATUS_LABEL: Record<string, string> = {
  PREPARING: "발송 후보",
  DELIVERED: "발송 완료",
  CANCELLED: "취소",
};

export const SEND_STATUS_COLOR: Record<string, string> = {
  PREPARING: "bg-blue-50 text-blue-700",
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

// ── Cafe24 품목 order_status (주문 가져오기 목록 표시용) ─────────────────────────
// import 대상은 N20(배송준비중)뿐. N20 외 배송상태(N21/N30/N40 등)는 "확인 후 진행" 경고,
// 취소·교환·반품(C/E/R) + 교환접수 N접두(N01/N03)는 import·금액에서 제외되는 claim
// (색상 미지정 → 회색 fallback). ItemBox 의 isClaim 판정과 동일 기준.
export const CAFE24_ITEM_STATUS_LABEL: Record<string, string> = {
  N00: "입금전", N02: "주문접수중", N10: "상품준비중",
  N20: "배송준비중", N21: "배송대기", N22: "배송보류",
  N30: "배송중", N40: "배송완료", N50: "구매확정",
  N01: "교환접수-교환상품", N03: "교환접수-카드결제대기",
  C00: "취소신청", C10: "취소접수-관리자", C11: "취소접수거부-관리자",
  C34: "취소처리중-환불전", C35: "취소처리중-환불완료", C36: "취소처리중-환불보류",
  C40: "취소완료", C41: "취소완료-환불전", C42: "취소완료-환불요청중", C43: "취소완료-환불보류",
  C47: "입금전취소-구매자", C48: "입금전취소-자동취소", C49: "입금전취소-관리자",
  R00: "반품신청", R10: "반품접수", R11: "반품접수거부", R12: "반품보류",
  R13: "반품접수-수거완료(자동)", R20: "반품수거완료", R30: "반품처리중-수거전",
  R31: "반품처리중-수거완료", R34: "반품처리중-환불전", R36: "반품처리중-환불보류",
  R40: "반품완료-환불완료", R41: "반품완료-환불전", R42: "반품완료-환불요청중", R43: "반품완료-환불보류",
  E00: "교환신청", E10: "교환접수", E11: "교환접수거부", E12: "교환보류",
  E13: "교환접수-수거완료(자동)", E20: "교환준비", E30: "교환처리중-수거전", E31: "교환처리중-수거완료",
  E32: "교환처리중-입금전", E33: "교환처리중-입금완료", E34: "교환처리중-환불전",
  E35: "교환처리중-환불완료", E36: "교환처리중-환불보류", E40: "교환완료", E41: "교환완료",
};

// N20 = import 대상(파랑) / 그 외 N계열 = 확인필요(주황) / C·E·R claim = 미지정 → 회색 fallback(제외)
export const CAFE24_ITEM_STATUS_COLOR: Record<string, string> = {
  N20: "bg-sky-100 text-sky-700",
  N00: "bg-amber-100 text-amber-700", N02: "bg-amber-100 text-amber-700",
  N10: "bg-amber-100 text-amber-700", N21: "bg-amber-100 text-amber-700",
  N22: "bg-amber-100 text-amber-700", N30: "bg-amber-100 text-amber-700",
  N40: "bg-amber-100 text-amber-700", N50: "bg-amber-100 text-amber-700",
  // N01/N03(교환접수)은 claim 취급 → 색상 미지정으로 회색 fallback(제외)
};
