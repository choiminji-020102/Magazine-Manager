// Cafe24 관련 타입

export interface Cafe24OAuthStartResponse {
  authorize_url: string;
}

export interface Cafe24TokenStatusResponse {
  authorized: boolean;
  expires_at?: string | null;
  refresh_token_expires_at?: string | null;
  mall_id: string;
  scopes: string[];
}

export interface Cafe24Product {
  product_no: number;
  product_code: string;
  product_name: string;
  price: string;
  retail_price: string;
  selling: string;
  list_image: string;
  product_weight: string;
  created_date: string;
  updated_date: string;
  already_imported: boolean;
}

export interface Cafe24ProductsResponse {
  products: Cafe24Product[];
}

// Cafe24 상품 → DB 저장 관련 타입

export interface Cafe24ProductImportItem {
  cafe24_product_code: string;
  product_code: string;
  product_kind: "YEARLY" | "MONTHLY";
  product_name: string;
  list_price: number;
  sale_price: number;
  cost_price: number;
  stock_quantity: number;
  unit_weight?: number | null;
}

export interface Cafe24ProductImportRequest {
  items: Cafe24ProductImportItem[];
}

export interface Cafe24ProductImportResultItem {
  cafe24_product_code: string;
  product_code: string;
  status: "created" | "skipped" | "failed";
  message?: string | null;
}

export interface Cafe24ProductImportResponse {
  created_count: number;
  skipped_count: number;
  failed_count: number;
  results: Cafe24ProductImportResultItem[];
}

// 매핑된 주문 품목 (백엔드에서 매핑 문서 규칙대로 변환됨)
export interface Cafe24MappedOrderItem {
  cafe24_product_code: string;              // Cafe24 원본
  external_order_item_id: string;           // = items[].order_item_code
  product_code: string | null;              // 매칭된 내부 Product.product_code (null이면 상품 미등록)
  product_kind: "YEARLY" | "MONTHLY" | null;
  product_name: string | null;
  unit_price: number;                       // Cafe24 1년 단가 (product_price 원본)
  sale_price: number | null;                // 1세트 실제 지불액 = unit_price × 년수 (매칭 실패 시 null)
  order_num: number;
  line_total: number | null;                // 라인 총액 = sale_price × order_num (매칭 실패 시 null)
  subscribe_period: number | null;
  option_value: string;                     // 원본 option_value (표시용)
}

// 매핑된 주문 (GET /cafe24/orders/ 응답의 orders[])
export interface Cafe24Order {
  external_order_id: string;
  order_channel: "CAFE24";
  order_status: "ORDERED" | "PAID" | "CANCELLED" | "UNPAID_CANCELLED" | "UNKNOWN" | null;
  send_fee: number | null;
  payment_method: string | null;            // cash/card/icash/tcash (또는 미매핑 원본)
  order_at: string | null;                  // ISO 8601
  payment_at: string | null;

  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;

  recipient_name: string | null;
  recipient_phone: string | null;
  country_code: string | null;
  postal_code: string | null;
  recipient_address: string | null;
  customer_memo: string | null;

  items: Cafe24MappedOrderItem[];

  total_amount: number | null;
  payment_amount: number | null;

  already_imported: boolean;
  detail_fetch_error?: string;              // 상세 조회 실패 시에만 존재
}

export interface Cafe24OrdersResponse {
  orders: Cafe24Order[];
}

// Cafe24 주문 Import 관련 타입

export interface Cafe24OrderImportRequest {
  external_order_ids: string[];
  dry_run?: boolean;
}

export interface Cafe24SkippedOrder {
  external_order_id: string;
  reason: string;
}

export interface Cafe24ImportWarning {
  external_order_id: string;
  message: string;
}

export interface Cafe24OrderImportResponse {
  imported_count: number;
  skipped_count: number;
  imported_order_ids: string[];
  skipped_orders: Cafe24SkippedOrder[];
  warnings: Cafe24ImportWarning[];
  dry_run?: boolean;
}

// Cafe24 주문 상세 (buyer + receivers + items)

export interface Cafe24Buyer {
  name: string;
  email: string;
  phone: string;
  cellphone: string;
  [key: string]: any;
}

export interface Cafe24Receiver {
  name: string;
  phone: string;
  cellphone: string;
  zipcode: string;
  address_full?: string;
  address1: string;
  address2: string;
  country_code: string | null;
  shipping_message: string;
  [key: string]: any;
}

export interface Cafe24OrderItem {
  order_item_code: string;
  product_code: string;
  product_name: string;
  product_price: string;
  quantity: number;
  option_value: string;
  option_id: string;
  payment_amount: string | null;
  [key: string]: any;
}

export interface Cafe24OrderDetail {
  buyer: Cafe24Buyer | null;
  receivers: Cafe24Receiver[];
  items: Cafe24OrderItem[];
}
