// OrderItem 관련 타입 (백엔드 스키마 기준)

import type { AddressCreate, AddressResponse } from "./address";

export interface PauseInfo {
  pause_id: number;
  pause_issue: string;
  reason?: string | null;
  created_at: string;
}

export interface OrderItemCreate {
  order_id: number;
  address_id: number;
  product_code: string;
  order_num?: number;
  sale_price?: number | null;
  subscribe_start_issue: string;
  subscribe_period?: number;
  admin_memo?: string | null;
  external_order_item_id?: string | null;
}

export interface OrderItemUpdate {
  order_num?: number | null;
  sale_price?: number | null;
  refund_amount?: number | null;
  subscribe_period?: number | null;
  final_subscribe_start_issue?: string | null;
  final_subscribe_end_issue?: string | null;
  admin_memo?: string | null;
}

export interface OrderItemAddressUpdate {
  address_id?: number | null;
  new_address?: AddressCreate | null;  // customer_id 포함 필수
}

export interface OrderItemCancelRequest {
  admin_memo: string;
  refund_amount?: number | null;
}

export interface SubscriptionExtendRequest {
  extend_months?: number | null;
  extend_end_issue?: string | null;
  is_paid?: boolean;
  reason?: string | null;
}

export interface SubscriptionBatchExtendRequest {
  order_item_ids: number[];
  extend_months: number;
  reason: string;
}

export interface SubscriptionChangePeriodRequest {
  new_start_issue: string;  // 새 구독 시작 호 (YYYYMM)
}

export interface SubscriptionShortenCalculateRequest {
  shorten_end_issue: string;  // 단축 종료 호 (YYYYMM)
}

export interface SubscriptionShortenCalculateResponse {
  current_end_issue: string;
  shorten_end_issue: string;
  shorten_count: number;      // 단축 회차 수
  paid_period: number;        // 유료 구독 기간 (총 개월)
  unit_price: number;         // 회차당 단가
  sale_price: number;         // 품목 판매가
  order_num: number;          // 수량
  refund_amount: number;      // 최종 환불금
}

export interface SubscriptionShortenConfirmRequest {
  shorten_end_issue: string;
  refund_confirmed: boolean;  // false면 저장 불가
  refund_bank?: string | null;
  refund_account?: string | null;
}

export interface OrderItemLastSendIssueUpdate {
  last_send_issue: string;  // 필수 (YYYYMM)
}

export interface SubscriptionBatchExtendResultItem {
  order_item_id: number;
  success: boolean;
  prev_end_issue?: string | null;
  new_end_issue?: string | null;
  error?: string | null;
}

export interface SubscriptionBatchExtendResponse {
  total_requested: number;
  success_count: number;
  fail_count: number;
  results: SubscriptionBatchExtendResultItem[];
}

export interface OrderItemResponse {
  order_item_id: number;
  external_order_item_id?: string | null;
  order_id: number;
  address_id: number;
  product_code: string;
  product_kind: string;
  product_name: string;
  list_price: number;
  sale_price: number;
  refund_amount: number;
  order_num: number;
  subscribe_start_issue: string;
  subscribe_end_issue: string;
  final_subscribe_start_issue: string;
  final_subscribe_end_issue: string;
  paid_subscribe_end_issue: string;
  subscribe_period: number;
  last_send_issue?: string | null;
  admin_memo?: string | null;
  sended_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
  address?: AddressResponse | null;
}

export interface OrderItemDetailResponse extends OrderItemResponse {
  pauses: PauseInfo[];
}

export interface SubscriptionListItem extends OrderItemResponse {
  customer_name?: string | null;
  customer_phone?: string | null;
  order_channel?: string | null;
}

export interface OrderItemListQuery {
  page?: number;
  limit?: number;
  product_kind?: string | null;
  product_code?: string | null;
  customer_search?: string | null;
  is_cancelled?: boolean | null;
  end_issue_from?: string | null;
  end_issue_to?: string | null;
  sort_by?: string;
  sort_order?: string;
}

export interface OrderItemAddressUpdateResponse {
  can_change: boolean;
  changed_address_id?: number | null;
  already_shipped_issues: string[];
  pending_issues: string[];
  message: string;
}
