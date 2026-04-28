// Send 관련 타입 (백엔드 스키마 기준)

import type { SendItemResponse } from "./sendItem";

export interface SendUpdate {
  recipient_name?: string | null;
  recipient_phone?: string | null;
  country_code?: string | null;
  postal_code?: string | null;
  recipient_address?: string | null;
  customer_memo?: string | null;
  admin_memo?: string | null;
}

export interface SendStatusUpdate {
  send_status: string;  // SHIPPING | DELIVERED | CANCELLED
  tracking_no?: string | null;
  courier_company?: string | null;
}

export interface SendTrackingUpdate {
  // 셋 다 Optional — 들어온 필드만 갱신. 셋 다 누락이면 백엔드 422.
  // SHIPPING/DELIVERED Send에만 허용 (PREPARING/CANCELLED 거부, 백엔드 400).
  // send_method ↔ courier_company 자동 도출 안 함 (완전 독립).
  tracking_no?: string | null;
  send_method?: string | null;     // 기출유우편 | 기출유택배 | 일반우편 | 찾아가기
  courier_company?: string | null; // CJ대한통운 | 자체배송
}

export interface SendResponse {
  send_id: number;
  order_ids: number[];                    // SendItem→OrderItem 경유 derived (백엔드 @property)
  address_id?: number | null;
  send_status: string;
  send_method?: string | null;            // 기출유우편 | 기출유택배 | 일반우편 | 찾아가기
  courier_company?: string | null;
  tracking_no?: string | null;
  recipient_name: string;
  recipient_phone: string;
  country_code: string;
  postal_code: string;
  recipient_address: string;
  customer_memo?: string | null;
  admin_memo?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SendDetailResponse extends SendResponse {
  items: SendItemResponse[];
}

export interface SendListQuery {
  page?: number;
  limit?: number;
  send_status?: string | null;
  courier_company?: string | null;
  tracking_no?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_cancelled?: boolean | null;
  recipient_search?: string | null;
  postal_code?: string | null;
  issue?: string | null;
  product_kind?: string | null;  // YEARLY | MONTHLY
  sort_by?: string;
  sort_order?: string;
}

// 일괄 상태 전환

export interface SendBatchStatusResult {
  send_id: number;
  success: boolean;
  message?: string | null;
}

export interface SendBatchStatusResponse {
  total: number;
  success_count: number;
  fail_count: number;
  results: SendBatchStatusResult[];
}
