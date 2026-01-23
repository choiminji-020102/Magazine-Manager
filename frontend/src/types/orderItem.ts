// OrderItem 관련 타입

export interface OrderItemResponse {
  order_item_id: number;
  external_order_item_id: string | null;
  order_id: number;
  product_code: string;
  product_kind: string;
  product_name: string;
  price: number;
  sale: number;
  refund: number | null;
  order_num: number;
  subscribe_start_issue: string | null;
  subscribe_end_issue: string | null;
  subscribe_period: number | null;
  last_send_issue: string | null;
  final_subscribe_end_issue: string | null;
  address_id: number;
  memo: string | null;
  created_at: string;
  sended_at: string | null;
  cancelled_at: string | null;
  updated_at: string;
  // Address info (optional join)
  address_name?: string | null;
  phone?: string | null;
  postal_code?: string | null;
  address1?: string | null;
  address2?: string | null;
}

export interface OrderItemCreate {
  product_code: string;
  external_order_item_id?: string | null;
  price?: number | null;
  sale?: number | null;
  order_num?: number;
  subscribe_start_issue?: string | null;
  subscribe_end_issue?: string | null;
  subscribe_period?: number;
  address?: {
    customer_id: number;
    address_name: string;
    phone: string;
    nation?: string;
    postal_code: string;
    address: string;
    address_memo?: string | null;
  } | null;
  address_id?: number | null;
  memo?: string | null;
}

export interface OrderItemUpdate {
  price?: number | null;
  sale?: number | null;
  refund?: number | null;
  order_num?: number | null;
  subscribe_start_issue?: string | null;
  subscribe_end_issue?: string | null;
  subscribe_period?: number | null;
  last_send_issue?: string | null;
  final_subscribe_end_issue?: string | null;
  memo?: string | null;
  address?: {
    customer_id: number;
    address_name: string;
    phone: string;
    nation?: string;
    postal_code: string;
    address: string;
    address_memo?: string | null;
  } | null;
  address_id?: number | null;
  sended_at?: string | null;
  cancelled_at?: string | null;
}

export interface SubscriptionUpdate {
  subscribe_start_issue?: string | null;
  subscribe_end_issue?: string | null;
  subscribe_period?: number | null;
}

export interface DispatchTargetItem {
  order_item_id: number;
  order_id: number;
  customer_id: number;
  customer_name: string;
  product_code: string;
  product_name: string;
  address_id: number;
  address_name: string;
  phone: string;
  postal_code: string;
  address: string;
  address_memo: string | null;
}

export interface DispatchTargetListResponse {
  issue: string;
  total_count: number;
  items: DispatchTargetItem[];
}
