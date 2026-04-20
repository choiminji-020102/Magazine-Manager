// Order 관련 타입 (백엔드 스키마 기준)

export enum PaymentMethod {
  CASH = "cash",      // 무통장
  CARD = "card",      // 신용카드
  ICASH = "icash",    // 가상계좌
  TCASH = "tcash",    // 계좌이체
}

export interface OrderListQuery {
  page?: number;
  limit?: number;
  order_channel?: string | null;
  order_status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  external_order_id?: string | null;
  customer_search?: string | null;    // 고객 이름/연락처
  recipient_search?: string | null;   // 수령인 이름/연락처
  payment_method?: PaymentMethod | null;
  admin_memo?: string | null;
  sort_by?: string;
  sort_order?: string;
}

export interface OrderCustomerInput {
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  create_channel?: string | null;
  admin_memo?: string | null;
}

export interface OrderAddressInput {
  recipient_name: string;
  recipient_phone: string;
  country_code?: string;        // 기본값: "KR"
  postal_code: string;
  recipient_address: string;
  customer_memo?: string | null;
}

export interface OrderItemCreateInOrder {
  product_code: string;
  order_num?: number;           // 기본값: 1
  sale_price?: number | null;   // 미입력 시 상품 판매가 자동 사용
  subscribe_period?: number;    // 기본값: 12
  admin_memo?: string | null;
}

export interface OrderCreate {
  customer_id?: number | null;
  customer?: OrderCustomerInput | null;

  address_id?: number | null;
  address?: OrderAddressInput | null;

  items: OrderItemCreateInOrder[];

  external_order_id?: string | null;
  order_channel?: string;       // 기본값: "OFFLINE"
  order_status?: string;        // 기본값: "ORDERED"

  send_fee?: number | null;     // 미입력 시 자동 설정 (MONTHLY: 3300, YEARLY: 0)
  payment_method: PaymentMethod; // 필수

  customer_memo?: string | null;
  admin_memo?: string | null;

  order_at?: string | null;
  payment_at?: string | null;
}

export interface OrderUpdate {
  address_id?: number | null;
  order_channel?: string | null;
  discount_amount?: number | null;
  refund_amount?: number | null;
  send_fee?: number | null;
  payment_method?: PaymentMethod | null;
  customer_memo?: string | null;
  admin_memo?: string | null;
  payment_at?: string | null;
}

export interface OrderCancelRequest {
  admin_memo: string;           // 취소 사유 필수
  refund_amount?: number | null;
  refund_bank?: string | null;
  refund_account?: string | null;
}

export interface OrderCancelItemDetail {
  order_item_id: number;
  product_name: string;
  product_kind: string;
  sale_price: number;
  order_num: number;
  delivered_count: number;
  total_period?: number | null;
  remaining_period?: number | null;
  unit_price?: number | null;
  item_refund: number;
}

export interface OrderCancelCalculateResponse {
  order_status: string;
  items: OrderCancelItemDetail[];
  subtotal: number;
  send_fee: number;
  discount_amount: number;
  total_refund: number;
  payment_amount: number;
}

export interface OrderPaymentUpdate {
  payment_method?: PaymentMethod | null;
  payment_at?: string | null;
}

export interface OrderResponse {
  order_id: number;
  customer_id: number;
  external_order_id?: string | null;
  address_id: number;
  order_channel: string;
  order_status: string;
  total_amount: number;
  discount_amount: number;
  refund_amount: number;
  send_fee: number;
  payment_amount: number;
  payment_method?: PaymentMethod | null;
  customer_memo?: string | null;
  admin_memo?: string | null;
  order_at: string;
  payment_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderDetailResponse extends OrderResponse {
  customer?: import("./customer").CustomerResponse | null;
  address?: import("./address").AddressResponse | null;
  items: import("./orderItem").OrderItemDetailResponse[];
  sends: import("./send").SendResponse[];
}

export interface OrderListResponse {
  order_id: number;
  customer_id: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  external_order_id?: string | null;
  address_id: number;
  order_channel: string;
  order_status: string;
  total_amount: number;
  discount_amount: number;
  refund_amount: number;
  send_fee: number;
  payment_amount: number;
  payment_method?: PaymentMethod | null;
  order_at: string;
  payment_at?: string | null;
  cancelled_at?: string | null;
  item_count: number;
}
