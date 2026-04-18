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

export interface Cafe24Order {
  order_id: string;
  billing_name: string;
  payment_method_name: string[];
  payment_amount: string;
  paid: string;
  canceled: string;
  order_date: string;
  payment_date: string | null;
  initial_order_amount?: {
    order_price_amount?: string;
    shipping_fee?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface Cafe24OrdersResponse {
  orders: Cafe24Order[];
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
