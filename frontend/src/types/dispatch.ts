// Dispatch 관련 타입

export interface DispatchTarget {
  order_item_id: number;
  order_id: number;
  customer_id: number;
  order_channel: string;
  product_code: string;
  send_product_code: string;
  product_kind: string;
  product_name: string;
  customer_name: string;
  customer_phone: string;
  address_id?: number | null;
  address_name?: string | null;
  phone?: string | null;
  postal_code?: string | null;
  address?: string | null;
  address_memo?: string | null;
}

export interface DispatchTargetsResponse {
  issue: string;
  product_code?: string | null;
  base_code?: string | null;
  count: number;
  targets: DispatchTarget[];
}

export interface DispatchGenerateRequest {
  product_code?: string | null;
  base_code?: string | null;
  send_date?: string | null;
}

export interface DispatchCreatedItem {
  send_id: number;
  order_item_id: number;
  customer_name: string;
  send_product_code: string;
}

export interface DispatchErrorItem {
  order_item_id: number;
  customer_name: string;
  error: string;
}

export interface DispatchGenerateResponse {
  issue: string;
  total_targets: number;
  created_count: number;
  error_count: number;
  created: DispatchCreatedItem[];
  errors: DispatchErrorItem[];
}

export interface SubscriptionStats {
  total_subscriptions: number;
  yearly_count: number;
  monthly_count: number;
  sent_count: number;
}

export interface DispatchSummaryResponse {
  issue: string;
  product_code?: string | null;
  base_code?: string | null;
  statistics: SubscriptionStats;
  pending_count: number;
}

export interface SingleTarget {
  order_item_id: number;
  order_id: number;
  customer_id: number;
  order_channel: string;
  product_code: string;
  send_product_code: string;
  product_kind: string;
  product_name: string;
  order_num: number;
  customer_name: string;
  customer_phone: string;
  address_id?: number | null;
  address_name?: string | null;
  phone?: string | null;
  postal_code?: string | null;
  address?: string | null;
  address_memo?: string | null;
}

export interface SingleTargetsResponse {
  product_code: string;
  count: number;
  targets: SingleTarget[];
}
