// Send 관련 타입 (백엔드 스키마 기준 — backend/app/schemas/send.py 와 1:1 매핑)

import type { SendItemResponse } from "./sendItem";

// ── Enum (백엔드 Literal 미러) ─────────────────────────────────────────────────

// SendMethodLiteral — backend/app/schemas/send.py
export type SendMethod = "기출유우편" | "기출유택배" | "일반우편" | "찾아가기";

// CourierCompanyLiteral — backend/app/schemas/send.py
export type CourierCompany = "CJ대한통운" | "자체배송";

// SendStatus — PREPARING/DELIVERED/CANCELLED 3값 (SHIPPING 폐기됨, 마이그레이션 011)
export type SendStatus = "PREPARING" | "DELIVERED" | "CANCELLED";

// ── 수정 스키마 ───────────────────────────────────────────────────────────────

export interface SendTrackingUpdate {
  // 셋 다 Optional — 들어온 필드만 갱신. 셋 다 누락이면 백엔드 422.
  // DELIVERED Send에만 허용. send_method ↔ courier_company 자동 도출 안 함 (완전 독립).
  // tracking_no는 입력에서 숫자만 추출 (공백·하이픈·문자 제거). 빈 결과면 422.
  tracking_no?: string | null;
  send_method?: SendMethod | null;
  courier_company?: CourierCompany | null;
}

export interface SendAdminMemoUpdate {
  // PATCH /sends/{send_id}/admin-memo — 상태 무관 (PREPARING/DELIVERED/CANCELLED 모두 허용).
  // 빈/공백 문자열은 백엔드에서 None 으로 저장 (메모 삭제).
  admin_memo: string | null;
}

export interface SendResendRequest {
  // POST /sends/{send_id}/resend — DELIVERED Send 재배송 내역 기록 (Send 본체 변경 없음).
  // send_item_ids: 박스 통째 재발송 시 UI가 모든 SendItem ID 채워서 보냄.
  reason: string;
  send_method: SendMethod;
  courier_company: CourierCompany;
  send_item_ids: number[];
  tracking_no: string;
  memo?: string | null;
}

// ── 응답 스키마 ───────────────────────────────────────────────────────────────

export interface RelatedOrderInfo {
  // Send 에 묶인 주문 정보 (자기 주문 외 묶인 주문 표시용).
  // SendItem→OrderItem→Order→Customer 경유 derived. 자기 orderId 제외는 프론트 책임.
  order_id: number;
  customer_name: string;
  customer_phone: string;
}

export interface SendResponse {
  send_id: number;
  order_ids: number[];                    // SendItem→OrderItem 경유 derived (백엔드 @property)
  related_orders: RelatedOrderInfo[];     // 묶인 주문 정보 (이름/전화 포함)
  address_id?: number | null;
  send_status: SendStatus;
  send_method?: SendMethod | null;
  courier_company?: CourierCompany | null;
  tracking_no?: string | null;
  recipient_name: string;
  recipient_phone: string;
  country_code: string;
  postal_code: string;
  recipient_address: string;
  customer_memo?: string | null;
  admin_memo?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SendDetailResponse extends SendResponse {
  items: SendItemResponse[];
}

export interface OrderItemSendResponse {
  // GET /order-items/{order_item_id}/sends — 그 품목의 발송 내역 1건 (SendItem + 소속 Send 요약).
  // 여러 품목이 아니라 한 품목의 호(issue)별 기록 — (품목, 호) 유니크라 행 1개 = 내역 1줄.
  // admin_memo 는 SendItem/Send 양쪽에 있어 item_/send_ 접두어로 구분.
  send_item_id: number;
  send_id: number;
  send_status: SendStatus;
  send_method?: SendMethod | null;
  courier_company?: CourierCompany | null;
  issue: string;
  tracking_no?: string | null;
  recipient_name: string;
  recipient_phone: string;
  country_code: string;
  postal_code: string;
  recipient_address: string;
  send_num: number;
  customer_memo?: string | null;
  item_admin_memo?: string | null;
  send_admin_memo?: string | null;
  delivered_at?: string | null;
  created_at: string;
}

// ── 목록 쿼리 ─────────────────────────────────────────────────────────────────

export interface SendListQuery {
  page?: number;
  limit?: number;
  send_status?: SendStatus | null;
  courier_company?: CourierCompany | null;
  tracking_no?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_cancelled?: boolean | null;
  recipient_search?: string | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  postal_code?: string | null;
  address_search?: string | null;         // 배송지 주소/우편번호 부분 일치
  issue?: string | null;
  product_kind?: "YEARLY" | "MONTHLY" | null;
  vip_slot_number?: number | null;        // 1~6, Address.vipN=true 필터
  sort_by?: string;
  sort_order?: "asc" | "desc";
}
