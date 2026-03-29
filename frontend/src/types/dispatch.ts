// Dispatch 관련 타입 (새 백엔드 스키마 기준)

export interface DispatchTarget {
  order_item_id: number;
  order_id: number;
  product_code: string;
  product_name: string;
  product_kind: string;
  order_num: number;
  subscribe_start_issue: string;
  final_subscribe_end_issue?: string | null;
  last_send_issue?: string | null;
  // 배송지 정보
  address_id?: number | null;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  country_code?: string | null;
  postal_code?: string | null;
  recipient_address?: string | null;
  customer_memo?: string | null;
}

export interface DispatchTargetsResponse {
  issue: string;
  targets: DispatchTarget[];
  total_count: number;
  page: number;
  limit: number;
  total_pages: number;
  product_summary: Record<string, number>; // {product_code: count}
}

export interface DispatchGenerateRequest {
  issue: string;
  official_send_date?: string | null;
  order_item_ids: number[];
}

export interface DispatchGenerateResult {
  order_item_id: number;
  success: boolean;
  send_id?: number | null;
  message?: string | null;
}

export interface DispatchGenerateResponse {
  issue: string;
  total_requested: number;
  success_count: number;
  fail_count: number;
  results: DispatchGenerateResult[];
}

export interface DispatchProductStat {
  product_code: string;
  product_name: string;
  total: number;
  dispatched: number;
  pending: number;
}

export interface DispatchSummaryResponse {
  issue: string;
  total_target_count: number;
  dispatched_count: number;
  pending_count: number;
  by_product: DispatchProductStat[];
  by_status: Record<string, number>;
}

export interface DispatchTrackingUploadResult {
  send_id: number;
  success: boolean;
  message?: string | null;
}

export interface DispatchTrackingUploadResponse {
  issue: string;
  total: number;
  success_count: number;
  fail_count: number;
  results: DispatchTrackingUploadResult[];
}
