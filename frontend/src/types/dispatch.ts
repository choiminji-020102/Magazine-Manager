// Dispatch 관련 타입

export interface DispatchTarget {
  order_item_id: number;
  order_id: number;
  customer_id: number;
  order_channel: string;
  product_code: string;
  product_kind: string;
  product_name: string;
  customer_name: string;
  customer_phone: string;
  address_name: string | null;
  phone: string | null;
  postal_code: string | null;
  address1: string | null;
  address2: string | null;
  address_memo: string | null;
}

export interface DispatchTargetsResponse {
  issue: string;
  count: number;
  targets: DispatchTarget[];
}

export interface DispatchGenerateRequest {
  product_code?: string | null;
  send_date?: string | null;
}

export interface DispatchCreatedItem {
  send_id: number;
  order_item_id: number;
  customer_name: string;
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
  statistics: SubscriptionStats;
  pending_count: number;
}
