// Order 관련 타입

export enum OrderChannel {
  CAFE24 = "CAFE24",
  GPMALL = "GPMALL",
  OFFLINE = "OFFLINE",
}

export enum OrderStatus {
  ORDERED = "ORDERED",
  PAID = "PAID",
  CANCELLED = "CANCELLED",
  SHIPPING = "SHIPPING",
  COMPLETED = "COMPLETED",
}

export interface OrderResponse {
  order_id: number;
  customer_id: number;
  external_order_id: string | null;
  order_channel: OrderChannel;
  order_status: OrderStatus;
  total_amount: number;
  discount_amount: number;
  refund_amount: number;
  send_fee: number;
  payment_amount: number;
  payment_method: string | null;
  address_id: number | null;
  request_memo: string | null;
  admin_memo: string | null;
  order_at: string;
  payment_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderListResponse {
  order_id: number;
  customer_id: number;
  customer_name: string | null;
  customer_phone: string | null;
  external_order_id: string | null;
  order_channel: OrderChannel;
  order_status: OrderStatus;
  total_amount: number;
  discount_amount: number;
  refund_amount: number;
  send_fee: number;
  payment_amount: number;
  order_at: string;
  item_count: number;
}

export interface OrderItemResponse {
  order_item_id: number;
  order_id: number;
  product_code: string;
  product_name: string;
  product_kind: "YEARLY" | "MONTHLY" | "SINGLE";
  price: number;
  sale: number;
  refund: number;
  order_num: number;
  subscribe_start_issue: string | null;
  subscribe_end_issue: string | null;
  subscribe_period: number | null;
  last_send_issue: string | null;
  final_subscribe_end_issue: string | null;
  memo: string | null;
  sended_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface OrderDetailResponse extends OrderResponse {
  customer: {
    customer_id: number;
    customer_name: string;
    customer_phone: string;
  } | null;
  address: {
    address_id: number;
    address_name: string;
    phone: string;
    address: string;
  } | null;
  items: OrderItemResponse[];
}

export interface OrderCustomerInput {
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
}

export interface OrderAddressInput {
  address_name: string;
  phone: string;
  nation?: string;
  postal_code: string;
  address: string;
  address_memo?: string | null;
}

export interface OrderItemCreateInOrder {
  product_code: string;
  order_num?: number;
  price?: number;
  sale?: number;
  subscribe_period?: number;
}

export interface OrderCreate {
  customer_id?: number | null;
  address_id?: number | null;
  customer?: OrderCustomerInput | null;
  address?: OrderAddressInput | null;
  external_order_id?: string | null;
  order_channel: OrderChannel;
  discount_amount?: number;
  send_fee?: number;
  payment_method?: string | null;
  request_memo?: string | null;
  admin_memo?: string | null;
  items: OrderItemCreateInOrder[];
}

export interface OrderUpdate {
  address_id?: number | null;
  order_status?: OrderStatus;
  discount_amount?: number;
  send_fee?: number;
  payment_method?: string | null;
  request_memo?: string | null;
  admin_memo?: string | null;
}

export interface OrderStatusUpdate {
  status: OrderStatus;
}
