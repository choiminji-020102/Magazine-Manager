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
  order_num: number;
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
  memo?: string | null;
  sended_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
}

export interface OrderItemDetailResponse {
  order_item_id: number;
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
  sended_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
  pauses: PauseInfo[];
}
