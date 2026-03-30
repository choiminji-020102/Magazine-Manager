// Send 관련 타입 (백엔드 스키마 기준)

import type { SendItemResponse } from "./sendItem";

export interface SendItemInput {
  order_item_id: number;
  issue: string;        // 발송 호 (YYYYMM)
  send_num?: number;    // 기본값: 1
}

export interface SendAddressInput {
  recipient_name: string;
  recipient_phone: string;
  country_code?: string;  // 기본값: "KR"
  postal_code: string;
  recipient_address: string;
  customer_memo?: string | null;
}

export interface SendCreate {
  order_id: number;
  address_id?: number | null;
  address?: SendAddressInput | null;
  official_send_date?: string | null;
  admin_memo?: string | null;
  items: SendItemInput[];
}

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
  tracking_no: string;
  courier_company: string;  // CJ대한통운 | 자체배송
}

export interface SendResponse {
  send_id: number;
  order_id: number;
  address_id?: number | null;
  send_status: string;
  courier_company?: string | null;
  tracking_no?: string | null;
  recipient_name: string;
  recipient_phone: string;
  country_code: string;
  postal_code: string;
  recipient_address: string;
  customer_memo?: string | null;
  admin_memo?: string | null;
  official_send_date?: string | null;
  prepared_at?: string | null;
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
  official_send_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_cancelled?: boolean | null;
  recipient_search?: string | null;
  postal_code?: string | null;
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
