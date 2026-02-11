// OrderItem 관련 타입

export interface PauseInfo {
  pause_id: number;
  pause_issue: string;
  reason?: string | null;
  created_at: string;
}

export interface OrderItemCreate {
  order_id: number;
  product_code: string;
  order_num: number; // 기본값 1 (백엔드에서 기본값 처리)
  price?: number | null;
  sale?: number | null;
  subscribe_start_issue?: string | null;
  subscribe_end_issue?: string | null;
}

export interface OrderItemUpdate {
  price?: number | null;
  sale?: number | null;
  refund?: number | null;
  order_num?: number | null;
  subscribe_start_issue?: string | null;
  subscribe_end_issue?: string | null;
  subscribe_period?: number | null;
  final_subscribe_end_issue?: string | null;
  memo?: string | null;
  address?: Record<string, any> | null;
}

export interface SubscriptionUpdate {
  subscribe_start_issue: string;
  subscribe_end_issue: string;
}

export interface OrderItemResponse {
  order_item_id: number;
  external_order_item_id?: string | null;
  order_id: number;
  product_code: string;
  product_kind: string;
  product_name: string;
  price: number;
  sale: number;
  refund?: number | null; // 백엔드 Optional[int] = 0 (기본값 0, null 가능)
  order_num: number;
  subscribe_start_issue?: string | null;
  subscribe_end_issue?: string | null;
  subscribe_period?: number | null;
  last_send_issue?: string | null;
  final_subscribe_end_issue?: string | null;
  memo?: string | null;
  created_at: string
  sended_at?: string | null;
  cancelled_at?: string | null;
  updated_at: string;
}

export interface OrderItemDetailResponse {
  order_item_id: number;
  external_order_item_id?: string | null;
  order_id: number;
  product_code: string;
  product_name: string;
  product_kind: string;
  price: number;
  sale: number;
  refund?: number | null;
  order_num: number;
  subscribe_start_issue?: string | null;
  subscribe_end_issue?: string | null;
  subscribe_period?: number | null;
  last_send_issue?: string | null;
  final_subscribe_end_issue?: string | null;
  address_id?: number | null;
  memo?: string | null;
  created_at: string;
  sended_at?: string | null;
  cancelled_at?: string | null;
  updated_at: string;
  pauses: PauseInfo[]; // 백엔드에서 항상 배열 반환 (기본값 빈 배열)
}
