import { OrderItemResponse } from "./orderItem";

export interface OrderListQuery {
  page?: number;
  limit?: number;
  search?: string | null;
  channel?: string | null;
  order_status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface OrderCustomerInput {
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  create_channel?: string | null;
  admin_memo?: string | null;
}

export interface OrderAddressInput {
  address_name: string;
  phone: string;
  nation?: string; // 기본값: "대한민국"
  postal_code: string;
  address: string;
  address_memo?: string | null;
}

export interface OrderItemCreateInOrder {
  product_code: string;
  order_num?: number; // 기본값: 1
  price?: number | null;
  sale?: number | null;
  subscribe_period?: number; // 기본값: 12
  memo?: string | null;
}

export interface OrderCreate {
  customer_id?: number | null;
  address_id?: number | null;

  customer?: OrderCustomerInput | null;
  address?: OrderAddressInput | null;

  external_order_id?: string | null; // 필요한 경우만 입력 받기

  items: OrderItemCreateInOrder[];

  order_channel?: string; // 기본값: "OFFLINE"
  order_status?: string; // 기본값: "ORDERED"

  discount_amount?: number; // 기본값: 0
  send_fee?: number; // 기본값: 0
  payment_method?: string | null;

  request_memo?: string | null;
  admin_memo?: string | null;
  
  payment_at?: string | null; // 결제를 했을 경우 order_status와 함께 꼭 입력 받기
}

export interface OrderUpdate {
  address_id?: number | null;
  order_status?: string | null;
  discount_amount?: number | null;
  refund_amount?: number | null;
  send_fee?: number | null;
  payment_method?: string | null;
  request_memo?: string | null;
  admin_memo?: string | null;
}

export interface OrderStatusUpdate {
  status: string;
}

export interface OrderResponse { // model Order 필드 다 있음
  order_id: number;
  customer_id: number;
  external_order_id?: string | null;
  order_channel: string;
  order_status: string;
  total_amount: number;
  discount_amount?: number; // 기본값: 0
  refund_amount?: number; // 기본값: 0
  send_fee?: number; // 기본값: 0
  payment_amount: number;
  payment_method?: string | null;
  address_id?: number | null;
  request_memo?: string | null;
  admin_memo?: string | null;
  order_at: string;
  payment_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderListResponse {
  order_id: number;
  customer_id: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  external_order_id?: string | null;
  order_channel: string;
  order_status: string;
  total_amount: number;
  discount_amount?: number; // 기본값: 0
  refund_amount?: number; // 기본값: 0
  send_fee?: number; // 기본값: 0
  payment_amount: number;
  order_at: string;
  item_count?: number; // 기본값: 0
}


export interface OrderDetailResponseCustomer {
  customer_id: number;
  customer_name: string;
  customer_phone: string;
}

export interface OrderDetailResponseAddress {
  address_id: number;
  address_name: string;
  phone: string;
  address: string;
}

export interface OrderDetailResponse extends OrderResponse {
  customer?: OrderDetailResponseCustomer | null;
  address?: OrderDetailResponseAddress | null;
  items: OrderItemResponse[];
}
